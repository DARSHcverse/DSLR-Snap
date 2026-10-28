import type { Bar } from "@/lib/admin/stats";

/**
 * Single-series column chart in plain HTML: one hue (the brand accent), 4px rounded tops on the
 * baseline, 2px gaps, a recessive baseline, a hover value on every bar and a table view.
 * One series, so the title names it and there's no legend.
 */
export function BarChart({ title, bars, empty }: { title: string; bars: Bar[]; empty?: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const total = bars.reduce((n, b) => n + b.value, 0);
  const every = bars.length > 8 ? 2 : 1; // label every other bar when crowded
  return (
    <figure className="rounded-card border border-line bg-surface p-5">
      <figcaption className="text-sm font-semibold">{title}</figcaption>
      {total === 0 ? (
        <p className="mt-6 mb-4 text-sm text-muted">{empty ?? "Nothing yet."}</p>
      ) : (
        <>
          <div className="mt-5 flex h-40 items-end gap-[2px] border-b border-line/70" role="img" aria-label={`${title}: ${bars.map((b) => `${b.label} ${b.display}`).join(", ")}`}>
            {bars.map((b) => (
              <div key={b.label} className="group relative flex h-full flex-1 items-end justify-center">
                {/* Hit target is the whole column, bigger than the bar itself. */}
                <div className="w-full max-w-7 rounded-t-[4px] bg-accent transition-opacity group-hover:opacity-80" style={{ height: `${Math.max(b.value ? 3 : 0, (b.value / max) * 100)}%` }} />
                <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-lg border border-line bg-surface-2 px-2 py-1 text-xs whitespace-nowrap text-fg shadow-lg group-hover:block">
                  <span className="text-muted">{b.label}</span> · <span className="font-semibold">{b.display}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-[2px] text-[11px] text-muted">
            {bars.map((b, i) => (
              <span key={b.label} className="flex-1 text-center">{i % every === (bars.length - 1) % every ? b.label : ""}</span>
            ))}
          </div>
        </>
      )}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-muted hover:text-fg">Show as table</summary>
        <table className="mt-2 w-full text-left">
          <tbody>
            {bars.map((b) => (
              <tr key={b.label} className="border-t border-line/60">
                <td className="py-1 text-muted">{b.label}</td>
                <td className="py-1 text-right font-medium">{b.display}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Customers by status: horizontal bars, each labelled in text (identity never by colour). */
export function StatusBars({ rows }: { rows: { label: string; value: number; hint: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <figure className="rounded-card border border-line bg-surface p-5">
      <figcaption className="text-sm font-semibold">Customers by status</figcaption>
      <dl className="mt-4 flex flex-col gap-3">
        {rows.map((r) => (
          <div key={r.label} title={r.hint}>
            <div className="flex justify-between text-sm">
              <dt className="text-muted">{r.label}</dt>
              <dd className="font-semibold">{r.value}</dd>
            </div>
            <div className="mt-1 h-2 rounded-full bg-surface-2">
              <div className="h-2 rounded-full bg-accent" style={{ width: `${(r.value / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </dl>
    </figure>
  );
}
