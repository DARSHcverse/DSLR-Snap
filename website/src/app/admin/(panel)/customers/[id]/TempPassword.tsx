"use client";

import { useActionState } from "react";
import { setTemporaryPassword, type TempPasswordResult } from "./actions";

/** Shows the new password once, in the page only (never in the URL or the log). */
export function TempPassword({ id }: { id: string }) {
  const [state, action, pending] = useActionState<TempPasswordResult, FormData>(setTemporaryPassword, null);
  if (state && "password" in state) {
    return (
      <div className="rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm">
        Temporary password (shown once): <code className="ml-1 rounded bg-bg px-2 py-0.5 font-mono text-base">{state.password}</code>
        <p className="mt-1 text-muted">Give it to them privately and ask them to change it under Forgot password.</p>
      </div>
    );
  }
  return (
    <form action={action} onSubmit={(e) => !confirm("Replace this customer's password with a temporary one?") && e.preventDefault()}>
      <input type="hidden" name="id" value={id} />
      <button disabled={pending} className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:bg-surface-2">
        {pending ? "Setting…" : "Set a temporary password"}
      </button>
      {state && "error" in state && <p className="mt-1 text-sm text-bad">{state.error}</p>}
    </form>
  );
}
