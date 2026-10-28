"use server";

import { sendEmail } from "@/lib/email/send";
import { contactReceived } from "@/lib/email/templates";
import { startThread } from "@/lib/support";
import { site } from "@/lib/site";

export type ContactResult = { ok: true } | { error: string } | null;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOPICS = ["Setting up", "Camera or printer", "Billing and account", "Sales question", "Something else"];

/**
 * Support form → a conversation in the admin inbox (the team is emailed) and a confirmation to the sender. Bots fill the hidden "website" field and are
 * quietly accepted and dropped. Without a key the form asks people to email instead.
 */
export async function sendContact(_prev: ContactResult, form: FormData): Promise<ContactResult> {
  if (String(form.get("website") ?? "")) return { ok: true };
  const name = String(form.get("name") ?? "").trim().slice(0, 100);
  const email = String(form.get("email") ?? "").trim().slice(0, 200);
  const topic = TOPICS.includes(String(form.get("topic"))) ? String(form.get("topic")) : "Something else";
  const message = String(form.get("message") ?? "").trim().slice(0, 5000);
  if (!name || !EMAIL.test(email) || message.length < 10) return { error: "Add your name, a valid email and a few words about what you need." };

  if (!process.env.RESEND_API_KEY) return { error: `The form isn't connected yet. Please email ${site.supportEmail}.` };
  // Opens a conversation in the admin inbox (which emails the team), then confirms to the sender.
  try {
    await startThread({ userId: null, email, name, subject: topic, body: message });
  } catch {
    return { error: `Couldn't send right now. Please email ${site.supportEmail}.` };
  }
  await sendEmail({ to: email, email: contactReceived({ topic }), template: "contact-received" });
  return { ok: true };
}
