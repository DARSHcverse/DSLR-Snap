// Shared form styles. Kept apart from PageShell so client components don't pull in server code.
export const inputClass =
  "w-full rounded-xl border border-line bg-bg px-4 py-3 text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none";
export const primaryButton =
  "inline-flex w-full items-center justify-center rounded-full bg-accent px-6 py-3 font-semibold text-accent-ink transition-transform active:scale-[0.97] disabled:opacity-50";
export const secondaryButton =
  "inline-flex items-center justify-center rounded-full border border-line px-5 py-2.5 font-semibold transition-colors hover:bg-surface-2 disabled:opacity-50";
