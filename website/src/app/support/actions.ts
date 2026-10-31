"use server";

import { sendEmail } from "@/lib/email/send";
import { contactReceived } from "@/lib/email/templates";
import { headers } from "next/headers";
import { ipFrom, overLimitHere } from "@/lib/rateLimit";
import { spamScore } from "@/lib/spamFilter";
import { verifyTurnstile } from "@/lib/turnstile";
import { startThread } from "@/lib/support";
import { site } from "@/lib/site";

export type ContactResult = { ok: true } | { error: string } | null;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOPICS = ["Setting up", "Camera or printer", "Billing and account", "Sales question", "Something else"];

/** People take longer than this to fill in the form; scripts post at once. */
const MIN_FILL_MS = 3_000;

/**
 * Support form → a conversation in the admin inbox (the team is emailed) and a confirmation to the sender.
 * Bots (the hidden "website" field filled, or posted within 3 seconds of the page opening) are quietly
 * accepted and dropped. Sales pitches (lib/spamFilter) are saved under Filtered in the admin, with
 * no email to the team and no confirmation to the sender (so the form can't be used to send email).
 */
export async function sendContact(_prev: ContactResult, form: FormData): Promise<ContactResult> {
  if (String(form.get("website") ?? "")) return { ok: true };
  const elapsed = Number(form.get("elapsed"));
  if (!Number.isFinite(elapsed) || elapsed < MIN_FILL_MS) return { ok: true };
  const name = String(form.get("name") ?? "").trim().slice(0, 100);
  const email = String(form.get("email") ?? "").trim().slice(0, 200);
  const topic = TOPICS.includes(String(form.get("topic"))) ? String(form.get("topic")) : "Something else";
  const message = String(form.get("message") ?? "").trim().slice(0, 5000);
  if (!name || !EMAIL.test(email) || message.length < 10) return { error: "Add your name, a valid email and a few words about what you need." };

  if (await overLimitHere("contact")) return { error: `You've sent several messages already. We'll reply soon, or email ${site.supportEmail}.` };
  if (!(await verifyTurnstile(String(form.get("cf-turnstile-response") ?? ""), ipFrom(await headers())))) {
    return { error: "We couldn't check you're a person. Please try again, or email us." };
  }
  const { spam, reasons } = spamScore(`${topic}\n${message}`);
  if (!process.env.RESEND_API_KEY) return { error: `The form isn't connected yet. Please email ${site.supportEmail}.` };
  // Opens a conversation in the admin inbox (which emails the team), then confirms to the sender.
  try {
    await startThread({ userId: null, email, name, subject: topic, body: message, spam: spam ? reasons : undefined });
  } catch {
    return { error: `Couldn't send right now. Please email ${site.supportEmail}.` };
  }
  if (!spam) await sendEmail({ to: email, email: contactReceived({ topic }), template: "contact-received" });
  return { ok: true };
}
