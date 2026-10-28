import "server-only";
import { site, productionUrl } from "../site";
import { supabaseAdmin } from "../supabase/server";
import { appUpdate } from "./templates";
import { TEAM_EMAIL } from "./send";

const FROM = process.env.EMAIL_FROM || `DSLR Snap <${site.contactEmail}>`;

/**
 * "DSLR Snap x.y is out" to every confirmed customer who hasn't unsubscribed. Each person gets their
 * own unsubscribe link, at most once per version (email_log), sent 100 at a time through Resend's
 * batch API (one request per 100, well inside its rate limit).
 */
export async function announceUpdate(o: { version: string; highlights: string[]; testOnly: boolean }): Promise<{ sent: number; skipped: number }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const db = supabaseAdmin();

  if (o.testOnly) {
    const e = appUpdate({ version: o.version, highlights: o.highlights, unsubscribeUrl: `${productionUrl}/email/unsubscribe?t=test` });
    await post(key, [{ from: FROM, to: [TEAM_EMAIL], subject: `[Test] ${e.subject}`, html: e.html, text: e.text }]);
    return { sent: 1, skipped: 0 };
  }

  // Everyone confirmed; then their unsubscribe tokens (creating profiles where missing).
  const users: { id: string; email: string }[] = [];
  for (let page = 1; ; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    users.push(...data.users.filter((u) => u.email && u.email_confirmed_at).map((u) => ({ id: u.id, email: u.email! })));
    if (data.users.length < 1000) break;
  }
  if (users.length) await db.from("customer_profiles").upsert(users.map((u) => ({ user_id: u.id })), { onConflict: "user_id", ignoreDuplicates: true });
  const { data: profiles } = await db.from("customer_profiles").select("user_id, unsubscribe_token, updates_opt_out_at");
  const byUser = new Map((profiles ?? []).map((p) => [p.user_id as string, p]));
  const wanted = users.filter((u) => byUser.get(u.id) && !byUser.get(u.id)!.updates_opt_out_at);

  // Claim each send in the log first; people already sent this version are skipped.
  const { data: claimed } = wanted.length
    ? await db
        .from("email_log")
        .upsert(wanted.map((u) => ({ key: `update:${o.version}:${u.id}`, to_email: u.email, template: "app-update" })), { onConflict: "key", ignoreDuplicates: true })
        .select("key")
    : { data: [] };
  const fresh = new Set((claimed ?? []).map((r) => r.key as string));
  const toSend = wanted.filter((u) => fresh.has(`update:${o.version}:${u.id}`));

  for (let i = 0; i < toSend.length; i += 100) {
    const chunk = toSend.slice(i, i + 100);
    const emails = chunk.map((u) => {
      const token = byUser.get(u.id)!.unsubscribe_token as string;
      const page = `${productionUrl}/email/unsubscribe?t=${token}`;
      const e = appUpdate({ version: o.version, highlights: o.highlights, unsubscribeUrl: page });
      return {
        from: FROM,
        to: [u.email],
        reply_to: site.supportEmail,
        subject: e.subject,
        html: e.html,
        text: e.text,
        headers: { "List-Unsubscribe": `<${productionUrl}/api/email/unsubscribe?t=${token}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        tags: [{ name: "template", value: "app-update" }],
      };
    });
    try {
      await post(key, emails);
    } catch (e) {
      // Release this chunk's claims so a retry sends them.
      await db.from("email_log").delete().in("key", chunk.map((u) => `update:${o.version}:${u.id}`));
      throw e;
    }
  }
  return { sent: toSend.length, skipped: users.length - toSend.length };
}

async function post(key: string, emails: object[]): Promise<void> {
  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(emails),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Resend batch failed: ${res.status} ${await res.text().catch(() => "")}`);
}
