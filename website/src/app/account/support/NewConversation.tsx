"use client";

import { useActionState } from "react";
import type { ReplyResult } from "@/components/chat/ReplyBox";
import { inputClass } from "@/components/ui";
import { newConversation } from "./actions";

export function NewConversation({ subject }: { subject?: string }) {
  const [state, run, pending] = useActionState<ReplyResult, FormData>(newConversation, null);
  return (
    <form action={run} className="flex flex-col gap-3">
      <input name="subject" defaultValue={subject} maxLength={120} placeholder="What's it about? (optional)" className={inputClass} />
      <textarea name="body" required rows={5} maxLength={4000} placeholder="Tell us what's happening. Photos of the screen help too: describe what you see." className={inputClass} />
      {state?.error && <p className="text-sm text-bad">{state.error}</p>}
      <button disabled={pending} className="self-start rounded-full bg-accent px-5 py-2.5 font-semibold text-accent-ink disabled:opacity-50">{pending ? "Sending…" : "Send message"}</button>
    </form>
  );
}
