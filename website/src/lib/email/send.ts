import "server-only";
import { site } from "../site";
import { supabaseAdmin } from "../supabase/server";
import type { RenderedEmail } from "./layout";

/** Sent from hello@; replies go to support@. Both are the only addresses customers ever see. */
const FROM = process.env.EMAIL_FROM || `DSLR Snap <${site.contactEmail}>`;
/** Where notices for the DSLR Snap team go (new customers, failed payments, messages). */
export const TEAM_EMAIL = process.env.TEAM_EMAIL || site.supportEmail;

export interface SendOptions {
  to: string;
  email: RenderedEmail;
  /** Template name, for the log and Resend's dashboard. */
  template: string;
  replyTo?: string;
  /** Sends at most once per key, even if the triggering event is delivered twice. */
  onceKey?: string;
  /** One-click unsubscribe (RFC 8058) for update emails. */
  unsubscribeUrl?: string;
}

/** Sends through Resend. Returns false (and logs) on failure, so a missing email never breaks a page. */
export async function sendEmail(o: SendOptions): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`email ${o.template} to ${o.to} skipped: RESEND_API_KEY is not set`);
    return false;
  }
  const db = o.onceKey ? supabaseAdmin() : null;
  if (db && o.onceKey) {
    const { error } = await db.from("email_log").insert({ key: o.onceKey, to_email: o.to, template: o.template });
    if (error?.code === "23505") return true; // already sent for this event
    if (error) console.error(`email log ${o.onceKey}:`, error.message);
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [o.to],
      reply_to: o.replyTo ?? site.supportEmail,
      subject: o.email.subject,
      html: o.email.html,
      text: o.email.text,
      tags: [{ name: "template", value: o.template }],
      ...(o.unsubscribeUrl
        ? { headers: { "List-Unsubscribe": `<${o.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }
        : {}),
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch((e: unknown) => {
    console.error(`email ${o.template} to ${o.to}:`, e);
    return null;
  });

  if (!res?.ok) {
    if (res) console.error(`email ${o.template} to ${o.to}: ${res.status} ${await res.text().catch(() => "")}`);
    if (db && o.onceKey) await db.from("email_log").delete().eq("key", o.onceKey); // let a retry try again
    return false;
  }
  return true;
}

/** The login email for an account, for emails triggered by Stripe or the app. */
export async function emailForUser(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin().auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}
