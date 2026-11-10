"use client";

import { useActionState } from "react";
import { type AuthResult, changePassword } from "@/app/(auth)/actions";
import { btnPrimary, field, input } from "@/components/dash/ui";

/** Settings → Password: the current password first (when there is one), then the new one. */
export function ChangePassword({ hasPassword }: { hasPassword: boolean }) {
  const [state, action, pending] = useActionState<AuthResult, FormData>(changePassword, null);
  return (
    <form action={action} className="flex max-w-md flex-col gap-3">
      {hasPassword && (
        <label className={field}>
          Current password
          <input name="current" type="password" autoComplete="current-password" required className={input} />
        </label>
      )}
      <label className={field}>
        {hasPassword ? "New password" : "Password"}
        <input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required className={input} />
      </label>
      {state?.error && <p className="text-sm text-bad" role="alert">{state.error}</p>}
      {state?.message && <p className="text-sm text-ok" role="status">{state.message}</p>}
      <button disabled={pending} className={`${btnPrimary} self-start`}>{pending ? "Saving…" : hasPassword ? "Change password" : "Set password"}</button>
    </form>
  );
}
