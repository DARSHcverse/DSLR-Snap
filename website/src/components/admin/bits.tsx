import type { CustomerStatus } from "@/lib/admin/data";

export const STATUS: Record<CustomerStatus, { label: string; hint: string; tone: string }> = {
  paying: { label: "Paying", hint: "Active paid plan", tone: "border-ok/40 text-ok" },
  cancelling: { label: "Cancelling", hint: "Paid, won't renew", tone: "border-accent/50 text-accent" },
  past_due: { label: "Payment failed", hint: "Card declined; Stripe is retrying", tone: "border-bad/50 text-bad" },
  free: { label: "Free access", hint: "Given in the admin", tone: "border-line text-fg" },
  trial: { label: "Trial", hint: "Confirmed, no plan (watermark)", tone: "border-line text-muted" },
  unconfirmed: { label: "Unconfirmed", hint: "Hasn't clicked the email link", tone: "border-line text-muted" },
};

/** Status chip: always a word, never colour alone. */
export function StatusBadge({ status }: { status: CustomerStatus }) {
  const s = STATUS[status];
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${s.tone}`} title={s.hint}>{s.label}</span>;
}

export function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export const day = (t: string | number | null) => (t ? new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
export const ago = (t: string | null) => {
  if (!t) return "never";
  const d = Math.round((Date.now() - Date.parse(t)) / 86_400_000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : d < 60 ? `${d} days ago` : day(t);
};
