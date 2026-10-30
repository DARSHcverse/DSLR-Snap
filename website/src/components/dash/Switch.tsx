/** A labelled on/off switch that is a real checkbox underneath (so the form posts it). */
export function Switch({ name, label, hint, on }: { name: string; label: string; hint: string; on: boolean }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3.5">
      <span>
        <span className="block text-sm font-medium text-fg">{label}</span>
        <span className="block text-sm text-muted">{hint}</span>
      </span>
      <input type="checkbox" name={name} defaultChecked={on} className="peer sr-only" />
      <span className="relative h-6 w-11 shrink-0 rounded-full bg-surface-2 ring-1 ring-line transition-colors peer-checked:bg-accent peer-checked:ring-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent after:absolute after:top-1 after:left-1 after:size-4 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:after:left-6" />
    </label>
  );
}
