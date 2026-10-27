"use client";

import { useActionState } from "react";
import { inputClass, primaryButton } from "@/components/ui";
import { type ContactResult, sendContact } from "./actions";

const TOPICS = ["Setting up", "Camera or printer", "Billing and account", "Sales question", "Something else"];

export function ContactForm() {
  const [state, action, pending] = useActionState<ContactResult, FormData>(sendContact, null);
  if (state && "ok" in state) {
    return <p className="rounded-card border border-ok/40 bg-ok/10 p-5">Thanks. We&apos;ll reply by email, usually within one working day.</p>;
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      {/* Hidden from people; bots fill it in. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm text-muted">
          Name
          <input name="name" required autoComplete="name" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-muted">
          Email
          <input name="email" type="email" required autoComplete="email" className={inputClass} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-sm text-muted">
        Topic
        <select name="topic" className={inputClass} defaultValue="Setting up">
          {TOPICS.map((t) => <option key={t}>{t}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm text-muted">
        How can we help?
        <textarea name="message" required minLength={10} rows={6} className={inputClass} placeholder="Your camera and printer models help us answer faster." />
      </label>
      {state && "error" in state && <p className="text-sm text-bad" role="alert">{state.error}</p>}
      <button disabled={pending} className={`${primaryButton} sm:w-auto sm:self-start sm:px-10`}>{pending ? "Sending…" : "Send"}</button>
    </form>
  );
}
