"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { btnPrimary, field, input } from "@/components/dash/ui";
import { newEvent } from "./actions";

/** The dashed "Create new event" tile; it turns into a short form in place. */
export function CreateEventCard({ startOpen = false }: { startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="group flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line text-muted transition-colors hover:border-accent hover:bg-accent/5 hover:text-fg"
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-surface-2 transition-colors group-hover:bg-accent group-hover:text-accent-ink">
          <Plus className="size-7" aria-hidden />
        </span>
        <span className="font-semibold">Create new event</span>
        <span className="px-6 text-center text-xs">For photos you add by hand. Booth events appear on their own.</span>
      </button>
    );
  }
  return (
    <form action={newEvent} className="relative flex aspect-square w-full flex-col justify-center gap-3 rounded-2xl border-2 border-accent/60 bg-surface p-5">
      <button type="button" onClick={() => setOpen(false)} className="absolute top-3 right-3 rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Cancel">
        <X className="size-4" />
      </button>
      <p className="font-semibold">New event</p>
      <label className={field}>Name<input name="name" required maxLength={120} autoFocus placeholder="Priya & Tom's Wedding" className={input} /></label>
      <label className={field}>Date<input name="date" type="date" className={input} /></label>
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className={btnPrimary}>{pending ? "Creating…" : "Create event"}</button>;
}
