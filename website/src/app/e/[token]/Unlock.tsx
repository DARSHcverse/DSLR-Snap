"use client";

import { useActionState } from "react";
import { inputClass, primaryButton } from "@/components/ui";
import { unlockGallery, type UnlockResult } from "./actions";

export function Unlock({ token, next }: { token: string; next?: "slideshow" }) {
  const [state, action, pending] = useActionState<UnlockResult, FormData>(unlockGallery, null);
  return (
    <form action={action} className="mx-auto mt-8 flex max-w-xs flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      {next && <input type="hidden" name="next" value={next} />}
      <input name="password" type="password" required autoFocus placeholder="Password" className={inputClass} />
      {state?.error && <p className="text-sm text-bad" role="alert">{state.error}</p>}
      <button disabled={pending} className={primaryButton}>{pending ? "Checking…" : "View photos"}</button>
    </form>
  );
}
