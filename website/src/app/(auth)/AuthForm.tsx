"use client";

import { useActionState } from "react";
import { inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { type AuthResult, googleAuth, passwordAuth } from "./actions";

export function AuthForm({ mode, next, notice, google }: { mode: "login" | "signup"; next: string; notice?: string; google: boolean }) {
  const [state, action, pending] = useActionState<AuthResult, FormData>(passwordAuth, null);
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
            <button className={`${secondaryButton} w-full`}>Continue with Google</button>
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
          Password
          <input
            name="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={mode === "signup" ? 8 : undefined}
            required
            className={inputClass}
          />
        </label>
        {state?.error && <p className="text-sm text-bad" role="alert">{state.error}</p>}
        <button disabled={pending} className={primaryButton}>
          {pending ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
