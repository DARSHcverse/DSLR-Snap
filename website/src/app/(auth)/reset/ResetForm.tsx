"use client";

import { useActionState } from "react";
import { inputClass, primaryButton } from "@/components/ui";
import { type AuthResult, requestPasswordReset, setNewPassword } from "../actions";

/** Step 1 emails a link; the link signs the user in and lands on step 2 to choose a new password. */
export function ResetForm({ step }: { step: "request" | "new" }) {
  const [state, action, pending] = useActionState<AuthResult, FormData>(step === "new" ? setNewPassword : requestPasswordReset, null);
  if (state?.message) return <p className="rounded-card border border-ok/40 bg-ok/10 p-5 text-pretty">{state.message}</p>;
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm text-muted">
        {step === "new" ? "New password" : "Email"}
        {step === "new" ? (
          <input name="password" type="password" autoComplete="new-password" minLength={8} required className={inputClass} />
        ) : (
          <input name="email" type="email" autoComplete="email" required className={inputClass} />
        )}
      </label>
      {state?.error && <p className="text-sm text-bad" role="alert">{state.error}</p>}
      <button disabled={pending} className={primaryButton}>
        {pending ? "One moment…" : step === "new" ? "Save new password" : "Email me a reset link"}
      </button>
    </form>
  );
}
