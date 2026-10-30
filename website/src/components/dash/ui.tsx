import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** Building blocks for the signed-in dashboard: page headers, cards, stat tiles, notices. */

export type Tone = "accent" | "green" | "violet" | "blue" | "amber" | "rose";

// Soft tinted chips behind icons, so each card is recognisable at a glance.
export const TONE: Record<Tone, string> = {
  accent: "bg-accent/15 text-accent",
  green: "bg-ok/15 text-ok",
  violet: "bg-[#8b7cf6]/15 text-[#a99dfa]",
  blue: "bg-[#4ea8f5]/15 text-[#7cc0fa]",
  amber: "bg-busy/15 text-busy",
  rose: "bg-bad/15 text-bad",
};

export function IconChip({ icon: I, tone = "accent", className = "size-10" }: { icon: LucideIcon; tone?: Tone; className?: string }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-xl ${TONE[tone]} ${className}`}>
      <I className="size-[45%]" strokeWidth={2} aria-hidden />
    </span>
  );
}

export function PageHeader({ title, intro, back, actions }: { title: ReactNode; intro?: ReactNode; back?: { href: string; label: string }; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
            <ChevronRight className="size-4 rotate-180" aria-hidden /> {back.label}
          </Link>
        )}
        <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-balance sm:text-3xl">{title}</h1>
        {intro && <p className="mt-1.5 max-w-2xl text-pretty text-muted">{intro}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, description, action, children, className = "", id }: { title?: ReactNode; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`rounded-2xl border border-line bg-surface p-5 sm:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** A summary card: icon, label, big value, an optional footer line. Links when given an href. */
export function StatCard({ icon, tone, label, value, sub, href, children }: { icon: LucideIcon; tone?: Tone; label: string; value: ReactNode; sub?: ReactNode; href?: string; children?: ReactNode }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <IconChip icon={icon} tone={tone} className="size-9 sm:size-10" />
        {href && <ChevronRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-fg" aria-hidden />}
      </div>
      <p className="mt-3 text-sm text-muted sm:mt-4">{label}</p>
      <p className="mt-0.5 font-display text-xl font-bold tracking-tight sm:text-2xl">{value}</p>
      {sub && <div className="mt-1 text-sm text-muted">{sub}</div>}
      {children}
    </>
  );
  const cls = "group flex min-w-0 flex-col rounded-2xl border border-line bg-surface p-4 transition-colors sm:p-5";
  return href ? (
    <Link href={href} className={`${cls} hover:border-accent/60 hover:bg-surface-2/40`}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Meter({ value, max, tone = "accent" }: { value: number; max: number; tone?: "accent" | "amber" }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  return (
    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className={`h-full rounded-full ${tone === "amber" ? "bg-busy" : "bg-accent"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** A big tappable row: icon, title, hint, chevron. For "quick actions". */
export function ActionRow({ icon, tone, title, hint, href, external }: { icon: LucideIcon; tone?: Tone; title: string; hint?: string; href: string; external?: boolean }) {
  const inner = (
    <>
      <IconChip icon={icon} tone={tone} />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        {hint && <span className="block truncate text-sm text-muted">{hint}</span>}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-fg" aria-hidden />
    </>
  );
  const cls = "group flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-accent/60 hover:bg-surface-2/40";
  return external ? (
    <a href={href} target="_blank" rel="noopener" className={cls}>{inner}</a>
  ) : (
    <Link href={href} className={cls}>{inner}</Link>
  );
}

export function Notice({ tone = "ok", children }: { tone?: "ok" | "bad" | "info"; children: ReactNode }) {
  const cls = { ok: "border-ok/40 bg-ok/10", bad: "border-bad/40 bg-bad/10", info: "border-[#4ea8f5]/40 bg-[#4ea8f5]/10" }[tone];
  return <p role={tone === "bad" ? "alert" : "status"} className={`mb-5 rounded-xl border px-4 py-3 text-sm ${cls}`}>{children}</p>;
}

export function EmptyState({ icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-surface/50 px-6 py-14 text-center">
      <IconChip icon={icon} className="size-14" />
      <p className="mt-4 font-semibold">{title}</p>
      {children && <div className="mt-1.5 max-w-md text-sm text-pretty text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Pill({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "ok" | "accent" | "amber" | "bad" }) {
  const cls = { muted: "border-line text-muted", ok: "border-ok/40 bg-ok/10 text-ok", accent: "border-accent/40 bg-accent/10 text-accent", amber: "border-busy/40 bg-busy/10 text-busy", bad: "border-bad/40 bg-bad/10 text-bad" }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${cls}`}>{children}</span>;
}

// Buttons used across the dashboard (smaller than the marketing site's).
export const btn = "inline-flex items-center justify-center gap-2 rounded-xl border border-line px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-surface-2 disabled:opacity-50";
export const btnPrimary = "inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition-transform active:scale-[0.98] disabled:opacity-50";
export const btnDanger = "inline-flex items-center justify-center gap-2 rounded-xl border border-bad/50 px-3.5 py-2 text-sm font-semibold text-bad transition-colors hover:bg-bad/10";
export const field = "flex flex-col gap-1.5 text-sm text-muted";
export const input = "w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none";
/** An icon-over-label button for an event's toolbar. */
export const toolButton = "flex min-w-[76px] flex-col items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg";
