import { verifyStandardWebhook } from "@/lib/email/hookSignature";
import { htmlToText, parseReplyAddress, stripQuoted } from "@/lib/email/inbound";
import { inboundDomain, inboundEnabled, inboundWebhookSecret, isTeamSender, receivingApiKey, replyKey } from "@/lib/email/inboundConfig";
import { addEmailReply } from "@/lib/support";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Resend → "email.received" (signed with Svix, the same Standard Webhooks scheme). The event only
 * carries metadata, so the body is fetched from Resend; the new part of the reply goes into the
 * support conversation its address names. Each email is handled once (email_log).
 */
interface ReceivedEvent {
  type: string;
  data: { email_id: string; from: string; to?: string[]; cc?: string[]; received_for?: string[] };
}

export async function POST(request: Request) {
  if (!inboundEnabled) return Response.json({ error: "not_configured" }, { status: 503 });
  const body = await request.text();
  const h = request.headers;
  const signed = verifyStandardWebhook(
    body,
    { id: h.get("svix-id") ?? h.get("webhook-id"), timestamp: h.get("svix-timestamp") ?? h.get("webhook-timestamp"), signature: h.get("svix-signature") ?? h.get("webhook-signature") },
    inboundWebhookSecret,
  );
  if (!signed) return Response.json({ error: "invalid signature" }, { status: 401 });

  const event = JSON.parse(body) as ReceivedEvent;
  if (event.type !== "email.received") return Response.json({ ignored: event.type });
  const { email_id: id, from } = event.data;
  const target = [...(event.data.to ?? []), ...(event.data.cc ?? []), ...(event.data.received_for ?? [])]
    .map((a) => a.match(/<([^>]+)>/)?.[1] ?? a)
    .map((a) => parseReplyAddress(a, replyKey, inboundDomain))
    .find(Boolean);
  if (!target) return Response.json({ ignored: "not a reply address" });

  // Once per email, even when Resend retries.
  const db = supabaseAdmin();
  const { error: dup } = await db.from("email_log").insert({ key: `inbound:${id}`, to_email: from, template: "inbound-reply" });
  if (dup?.code === "23505") return Response.json({ ignored: "already handled" });

  const api = process.env.RESEND_API_URL || "https://api.resend.com"; // overridable for local tests
  const res = await fetch(`${api}/emails/receiving/${encodeURIComponent(id)}`, {
    headers: { authorization: `Bearer ${receivingApiKey}` },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res?.ok) {
    await db.from("email_log").delete().eq("key", `inbound:${id}`); // let Resend's retry try again
    console.error(`inbound ${id}: fetch failed ${res?.status ?? "network"}`);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
  const email = (await res.json()) as { text?: string | null; html?: string | null };
  let html = email.html ?? "";
  const dataUri = html.match(/^data:text\/html[^,]*;base64,([\s\S]*)$/);
  if (dataUri) html = Buffer.from(dataUri[1], "base64").toString("utf8");
  const text = stripQuoted(email.text?.trim() ? email.text : htmlToText(html));

  const sender = (from.match(/<([^>]+)>/)?.[1] ?? from).trim();
  const result = await addEmailReply({ thread: target.thread, role: target.role, from: sender, body: text, teamSender: isTeamSender(sender) });
  if (result === "ignored") console.warn(`inbound ${id}: ignored reply from ${sender} (${target.role})`);
  return Response.json({ result });
}
