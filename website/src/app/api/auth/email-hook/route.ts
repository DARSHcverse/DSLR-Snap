import { supabaseConfig } from "@/lib/config";
import { verifyStandardWebhook } from "@/lib/email/hookSignature";
import { sendEmail } from "@/lib/email/send";
import * as t from "@/lib/email/templates";
import type { RenderedEmail } from "@/lib/email/layout";

/**
 * Supabase Auth → "Send Email" hook (Authentication → Hooks). Supabase hands every sign-up,
 * password-reset and email-change email to this route instead of sending its own, so they all
 * use DSLR Snap's design. Requests must carry Supabase's signature (SEND_EMAIL_HOOK_SECRET).
 */
interface HookPayload {
  user: { email: string; new_email?: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

const fail = (status: number, message: string) => Response.json({ error: { http_code: status, message } }, { status });

export async function POST(request: Request) {
  const body = await request.text();
  const ok = verifyStandardWebhook(
    body,
    { id: request.headers.get("webhook-id"), timestamp: request.headers.get("webhook-timestamp"), signature: request.headers.get("webhook-signature") },
    process.env.SEND_EMAIL_HOOK_SECRET ?? "",
  );
  if (!ok || !supabaseConfig) return fail(401, "invalid signature");

  let p: HookPayload;
  try {
    p = JSON.parse(body) as HookPayload;
  } catch {
    return fail(400, "bad payload");
  }
  const d = p.email_data;
  const link = (tokenHash: string) =>
    `${supabaseConfig!.url}/auth/v1/verify?${new URLSearchParams({ token: tokenHash, type: d.email_action_type, redirect_to: d.redirect_to })}`;

  const sends: { to: string; email: RenderedEmail; template: string }[] = [];
  switch (d.email_action_type) {
    case "signup":
      sends.push({ to: p.user.email, email: t.confirmSignup(link(d.token_hash)), template: "auth-signup" });
      break;
    case "recovery":
      sends.push({ to: p.user.email, email: t.resetPassword(link(d.token_hash)), template: "auth-recovery" });
      break;
    case "magiclink":
      sends.push({ to: p.user.email, email: t.magicLink(link(d.token_hash)), template: "auth-magiclink" });
      break;
    case "invite":
      sends.push({ to: p.user.email, email: t.inviteUser(link(d.token_hash)), template: "auth-invite" });
      break;
    case "reauthentication":
      sends.push({ to: p.user.email, email: t.reauthCode(d.token), template: "auth-reauth" });
      break;
    case "email_change": {
      // Secure email change: the current address confirms with token_hash_new, the new one with token_hash.
      const next = p.user.new_email ?? p.user.email;
      if (d.token_hash_new) sends.push({ to: p.user.email, email: t.emailChange(link(d.token_hash_new), next), template: "auth-email-change" });
      if (d.token_hash) sends.push({ to: next, email: t.emailChange(link(d.token_hash), next), template: "auth-email-change" });
      break;
    }
    default:
      return fail(400, `unsupported email type ${d.email_action_type}`);
  }

  const results = await Promise.all(sends.map((s) => sendEmail(s)));
  return results.every(Boolean) ? Response.json({}) : fail(500, "email could not be sent");
}
