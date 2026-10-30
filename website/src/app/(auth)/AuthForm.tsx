"use client";

import { Eye, EyeOff } from "lucide-react";
import { useActionState, useState } from "react";
import { inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { type AuthResult, googleAuth, passwordAuth } from "./actions";

export function AuthForm({ mode, next, notice, google }: { mode: "login" | "signup"; next: string; notice?: string; google: boolean }) {
  const [state, action, pending] = useActionState<AuthResult, FormData>(passwordAuth, null);
  const [show, setShow] = useState(false);
  if (state?.message) {
    return <p className="rounded-card border border-ok/40 bg-ok/10 p-5 text-pretty">{state.message}</p>;
  }
  return (
    <div className="flex flex-col gap-6">
      {notice && <p className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-muted">{notice}</p>}
      {google && (
        <>
          <form action={googleAuth}>
            <input type="hidden" name="next" value={next} />
            <button className={`${secondaryButton} w-full gap-3 bg-white text-[#1f1f1f] hover:bg-white/90`}>
              <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
              </svg>
              Continue with Google
            </button>
          </form>
          <div className="flex items-center gap-3 text-xs tracking-[0.2em] text-muted uppercase">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="mode" value={mode} />
        <input type="hidden" name="next" value={next} />
        <label className="flex flex-col gap-1.5 text-sm text-muted">
          Email
          <input name="email" type="email" autoComplete="email" required className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-muted">
          <span className="flex justify-between">
            Password
            {mode === "login" && <a href="/reset" className="text-accent hover:underline">Forgot password?</a>}
          </span>
          <span className="relative">
          <input
            name="password"
            type={show ? "text" : "password"}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={mode === "signup" ? 8 : undefined}
            required
            className={`${inputClass} pr-12`}
          />
            <button type="button" onClick={() => setShow((v) => !v)} className="absolute top-1/2 right-3 -translate-y-1/2 rounded p-1 text-muted hover:text-fg" aria-label={show ? "Hide password" : "Show password"}>
              {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </span>
        </label>
        {state?.error && <p className="text-sm text-bad" role="alert">{state.error}</p>}
        <button disabled={pending} className={primaryButton}>
          {pending ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
