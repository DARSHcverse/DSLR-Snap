"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { inputClass } from "@/components/ui";

export type ReplyResult = { error?: string; ok?: number } | null;

/** Message box: Enter sends, Shift+Enter adds a line. Clears after each send. */
export function ReplyBox({ action, hidden, placeholder }: { action: (prev: ReplyResult, form: FormData) => Promise<ReplyResult>; hidden: Record<string, string>; placeholder: string }) {
  const [state, run, pending] = useActionState<ReplyResult, FormData>(action, null);
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (!state?.ok) return;
    form.current?.reset();
    router.refresh(); // show the message just sent straight away
  }, [state, router]);
  return (
    <form ref={form} action={run} className="flex flex-col gap-2">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <textarea
        name="body"
        required
        rows={3}
        maxLength={4000}
        placeholder={placeholder}
        className={inputClass}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            form.current?.requestSubmit();
          }
        }}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted">{state?.error ? <span className="text-bad">{state.error}</span> : "Enter to send · Shift+Enter for a new line"}</span>
        <button disabled={pending} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50">{pending ? "Sending…" : "Send"}</button>
      </div>
    </form>
  );
}
