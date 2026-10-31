"use client";

import { useActionState, useEffect, useRef } from "react";
import { inputClass, primaryButton } from "@/components/ui";
import { type ContactResult, sendContact } from "./actions";

const TOPICS = ["Setting up", "Camera or printer", "Billing and account", "Sales question", "Something else"];

interface TurnstileApi {
  render: (el: HTMLElement, o: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** Loads Cloudflare's script once, however many times the form mounts. */
function loadTurnstile(): Promise<TurnstileApi> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const id = "cf-turnstile-script";
    let s = document.getElementById(id) as HTMLScriptElement | null;
    if (!s) {
      s = Object.assign(document.createElement("script"), { id, src: "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit", async: true });
      document.head.append(s);
    }
    s.addEventListener("load", () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile"))));
    s.addEventListener("error", reject);
  });
}

/** `turnstileKey` is empty until Turnstile is set up; then an (usually invisible) check is added. */
export function ContactForm({ turnstileKey = "" }: { turnstileKey?: string }) {
  const [state, action, pending] = useActionState<ContactResult, FormData>(sendContact, null);
  const opened = useRef(0);
  const elapsed = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);

  useEffect(() => {
    opened.current = Date.now();
  }, []);

  useEffect(() => {
    if (!turnstileKey || !box.current) return;
    let cancelled = false;
    loadTurnstile()
      .then((t) => {
        if (!cancelled && box.current && !widget.current) widget.current = t.render(box.current, { sitekey: turnstileKey, theme: "dark", appearance: "interaction-only" });
      })
      .catch(() => {}); // blocked by an extension: the server lets it through and the content filter still applies
    return () => {
      cancelled = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [turnstileKey]);

  // A token works once: after an error the next attempt needs a fresh one.
  useEffect(() => {
    if (state && "error" in state && widget.current) window.turnstile?.reset(widget.current);
  }, [state]);

  if (state && "ok" in state) {
    return <p className="rounded-card border border-ok/40 bg-ok/10 p-5">Thanks. We&apos;ll reply by email, usually within one working day.</p>;
  }
  return (
    <form action={action} onSubmit={() => elapsed.current && (elapsed.current.value = String(Date.now() - opened.current))} className="flex flex-col gap-4">
      <p className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-muted">
        For questions about DSLR Snap only. We don&apos;t accept SEO, marketing, design or development offers, and they won&apos;t be answered.
      </p>
      {/* Hidden from people; bots fill it in. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <input ref={elapsed} type="hidden" name="elapsed" defaultValue="" />
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
      {turnstileKey && <div ref={box} />}
      {state && "error" in state && <p className="text-sm text-bad" role="alert">{state.error}</p>}
      <button disabled={pending} className={`${primaryButton} sm:w-auto sm:self-start sm:px-10`}>{pending ? "Sending…" : "Send"}</button>
    </form>
  );
}
