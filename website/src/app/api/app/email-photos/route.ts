import { deviceFromRequest, fail, notConfigured, readJson, signedOut } from "@/lib/appApi";
import { emailForUser, sendEmail } from "@/lib/email/send";
import { guestPhotos } from "@/lib/email/templates";
import { isUuid } from "@/lib/gallery";
import { ipFrom, overLimit, tooMany } from "@/lib/rateLimit";
import { productionUrl } from "@/lib/site";
import { supabaseAdmin } from "@/lib/supabase/server";

const EMAIL = /^[a-z0-9._%+'-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

/**
 * A guest typed their email at the booth: send them the link to their photos, on the operator's
 * behalf (replies go to the operator). Once per guest and session, however often the booth retries.
 * The session may not be uploaded yet (the booth was offline); its page says so until it is.
 */
export async function POST(request: Request) {
  if (await overLimit("appGuestEmail", ipFrom(request.headers))) return tooMany();
  const off = notConfigured();
  if (off) return off;
  const body = await readJson(request);
  const device = await deviceFromRequest(body);
  if (!device || !body) return signedOut();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isUuid(body.sessionId) || email.length > 254 || !EMAIL.test(email)) return fail(400, "invalid_request", "Bad request.");
  const db = supabaseAdmin();
  // Never for another account's session.
  const { data: session } = await db.from("gallery_sessions").select("user_id").eq("id", body.sessionId).maybeSingle();
  if (session && session.user_id !== device.userId) return fail(404, "not_found", "Session not found.");
  const [{ data: profile }, operatorEmail] = await Promise.all([
    db.from("customer_profiles").select("business_name").eq("user_id", device.userId).maybeSingle(),
    emailForUser(device.userId),
  ]);
  const event = (typeof body.event === "string" ? body.event.replace(/\s+/g, " ").trim().slice(0, 120) : "") || "the event";
  const sent = await sendEmail({
    to: email,
    email: guestPhotos({ event, url: `${productionUrl}/s/${body.sessionId}`, from: profile?.business_name?.trim() || undefined }),
    template: "guest-photos",
    replyTo: operatorEmail ?? undefined,
    onceKey: `guest:${body.sessionId}:${email}`,
  });
  if (!sent) return fail(502, "send_failed", "Couldn't send the email right now.");
  return Response.json({ ok: true });
}
