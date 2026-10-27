"use client";

import { useActionState, useEffect } from "react";
import { primaryButton, secondaryButton } from "@/components/ui";
import { type ApproveResult, approveAppSignIn } from "./actions";

export function ApproveSignIn({ challenge, state }: { challenge: string; state: string }) {
  const [result, action, pending] = useActionState<ApproveResult, FormData>(approveAppSignIn, null);
  const link = result && "link" in result ? result.link : null;

  // Hand straight back to the app; the browser asks once whether to open DSLR Snap.
  useEffect(() => {
    if (link) window.location.href = link;
  }, [link]);

  if (result && "code" in result) {
    return (
      <div className="mt-6 flex flex-col gap-4">
        <p className="font-semibold">Done. DSLR Snap should open by itself.</p>
        <a href={result.link} className={secondaryButton}>Open DSLR Snap</a>
        <p className="text-sm text-muted">If it doesn&apos;t, type this code in the app (valid 10 minutes):</p>
        <p className="rounded-xl border border-line bg-bg py-4 text-center font-mono text-3xl tracking-[0.3em]">{result.code}</p>
      </div>
    );
  }
  return (
    <form action={action} className="mt-6 flex flex-col gap-3">
      <input type="hidden" name="challenge" value={challenge} />
      <input type="hidden" name="state" value={state} />
      {result && "error" in result && <p className="text-sm text-bad" role="alert">{result.error}</p>}
      <button disabled={pending} className={primaryButton}>{pending ? "One moment…" : "Open DSLR Snap"}</button>
      <p className="text-sm text-muted">Didn&apos;t start this from your booth computer? Just close this page.</p>
    </form>
  );
}
