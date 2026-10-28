"use client";

import { useActionState } from "react";
import { inputClass, primaryButton } from "@/components/ui";
import { type LoginResult, loginCode, loginPassword } from "./actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState<LoginResult, FormData>(loginPassword, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm text-muted">
        Username
        <input name="username" autoComplete="username" required autoFocus className={inputClass} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm text-muted">
        Password
        <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </label>
      {state?.error && <p className="text-sm text-bad" role="alert">{state.error}</p>}
      <button disabled={pending} className={primaryButton}>{pending ? "Checking…" : "Continue"}</button>
    </form>
  );
}

export function CodeForm() {
  const [state, action, pending] = useActionState<LoginResult, FormData>(loginCode, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm text-muted">
        6-digit code from your authenticator app
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          required
          autoFocus
          className={`${inputClass} text-center font-mono text-2xl tracking-[0.4em]`}
        />
      </label>
      {state?.error && <p className="text-sm text-bad" role="alert">{state.error}</p>}
      <button disabled={pending} className={primaryButton}>{pending ? "Checking…" : "Sign in"}</button>
    </form>
  );
}
