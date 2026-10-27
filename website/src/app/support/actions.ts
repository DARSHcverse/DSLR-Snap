"use server";

import { site } from "@/lib/site";

export type ContactResult = { ok: true } | { error: string } | null;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOPICS = ["Setting up", "Camera or printer", "Billing and account", "Sales question", "Something else"];

/**
 * Support form → email via Resend (RESEND_API_KEY). Bots fill the hidden "website" field and are
 * quietly accepted and dropped. Without a key the form asks people to email instead.
 */
export async function sendContact(_prev: ContactResult, form: FormData): Promise<ContactResult> {
  if (String(form.get("website") ?? "")) return { ok: true };
  const name = String(form.get("name") ?? "").trim().slice(0, 100);
  const email = String(form.get("email") ?? "").trim().slice(0, 200);
  const topic = TOPICS.includes(String(form.get("topic"))) ? String(form.get("topic")) : "Something else";
  const message = String(form.get("message") ?? "").trim().slice(0, 5000);
  if (!name || !EMAIL.test(email) || message.length < 10) return { error: "Add your name, a valid email and a few words about what you need." };

  const key = process.env.RESEND_API_KEY;
  if (!key) return { error: `The form isn't connected yet. Please email ${site.supportEmail}.` };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM || `DSLR Snap website <noreply@dslrsnap.com>`,
      to: [process.env.CONTACT_TO || site.supportEmail],
      reply_to: email,
      subject: `[${topic}] ${name}`,
      text: `${message}\n\n—\n${name} <${email}>\nTopic: ${topic}`,
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res?.ok) return { error: `Couldn't send right now. Please email ${site.supportEmail}.` };
  return { ok: true };
}
