import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BarChart } from "@/components/admin/BarChart";
import { ago, Tile } from "@/components/admin/bits";
import { listCustomers } from "@/lib/admin/data";
import { adminHref, requireAdmin } from "@/lib/admin/server";
import { type Period, PERIODS, websiteStats } from "@/lib/admin/siteStats";
import { EVENTS } from "@/lib/track";

export const metadata: Metadata = { title: "Website" };

export default function WebsitePage({ searchParams }: PageProps<"/admin/website">) {
  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight">Website</h1>
      <p className="mt-1 text-sm text-muted">Who visits, what they click and who downloads. No cookies; people are counted once a day.</p>
      <Suspense fallback={<p className="mt-6 text-muted">Loading numbers…</p>}>
        <Website searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const n = (v: number) => Number(v).toLocaleString("en-GB");
const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "–");
const regions = new Intl.DisplayNames(["en"], { type: "region" });
const countryName = (code: string | null) => {
  if (!code) return "Unknown";
  try {
    return regions.of(code) ?? code;
  } catch {
    return code;
  }
};

async function Website({ searchParams }: Pick<PageProps<"/admin/website">, "searchParams">) {
  await requireAdmin();
  const sp = await searchParams;
  const period = (PERIODS.find((p) => String(p) === sp.days) ?? 30) as Period;
  const s = await websiteStats(period, await listCustomers());

  const funnel = [
    { label: "Visited the site", value: s.visitors },
    { label: "Downloaded the app", value: s.downloaders },
    { label: "Created an account", value: s.signups },
    { label: "Connected a booth computer", value: s.connected },
    ...(s.newPaying !== null ? [{ label: "Started paying", value: s.newPaying }] : []),
  ];
  const top = Math.max(1, ...funnel.map((f) => f.value));

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Link key={p} href={adminHref(`website?days=${p}`)} className={`rounded-full border px-3 py-1 text-sm ${p === period ? "border-accent bg-accent/10 text-fg" : "border-line text-muted hover:text-fg"}`}>
            Last {p} days
          </Link>
        ))}
      </div>

      {!s.ready && (
        <p className="rounded-card border border-bad/40 bg-bad/10 px-5 py-4 text-sm">
          Tracking isn&apos;t set up in the database yet. Run <code>supabase/migrations/0015_site_events.sql</code> in the Supabase SQL editor.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Visitors" value={n(s.visitors)} sub={`${n(s.views)} pages viewed`} />
        <Tile label="Downloads" value={n(s.downloads)} sub={`${n(s.downloaders)} people · ${pct(s.downloaders, s.visitors)} of visitors`} />
        <Tile label="New accounts" value={n(s.signups)} sub={`${pct(s.signups, s.downloaders)} of people who downloaded`} />
        <Tile label="Computers connected" value={n(s.connected)} sub={s.newPaying !== null ? `${n(s.newPaying)} started paying` : "Stripe not connected"} />
      </div>

      <section className="rounded-card border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">From visit to paying customer</h2>
        <p className="mt-1 text-xs text-muted">Each step as a share of the step before. These are totals, not the same people followed through: a visitor can&apos;t be linked to an account later without cookies.</p>
        <dl className="mt-4 flex flex-col gap-3">
          {funnel.map((f, i) => (
            <div key={f.label}>
              <div className="flex justify-between gap-4 text-sm">
                <dt className="text-muted">{f.label}</dt>
                <dd><span className="font-semibold">{n(f.value)}</span>{i > 0 && <span className="ml-2 text-muted">{pct(f.value, funnel[i - 1].value)}</span>}</dd>
              </div>
              <div className="mt-1 h-2 rounded-full bg-surface-2">
                <div className="h-2 rounded-full bg-accent" style={{ width: `${(f.value / top) * 100}%` }} />
              </div>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <BarChart title={period > 31 ? "Downloads by week" : "Downloads by day"} bars={s.downloadBars} empty="No downloads in this period." />
        <BarChart title={period > 31 ? "Visitors by week" : "Visitors by day"} bars={s.visitorBars} empty="No visits recorded yet." />
      </div>

      <section className="overflow-x-auto rounded-card border border-line bg-surface">
        <h2 className="px-5 pt-5 text-sm font-semibold">Latest downloads</h2>
        {s.recent.length ? (
          <table className="mt-3 w-full min-w-[720px] text-left text-sm">
            <thead className="text-muted">
              <tr className="border-y border-line">
                <th className="px-5 py-2.5 font-medium">When</th>
                <th className="px-5 py-2.5 font-medium">Who</th>
                <th className="px-5 py-2.5 font-medium">Button</th>
                <th className="px-5 py-2.5 font-medium">Came from</th>
                <th className="px-5 py-2.5 font-medium">Country</th>
                <th className="px-5 py-2.5 font-medium">Device</th>
                <th className="px-5 py-2.5 font-medium">Version</th>
              </tr>
            </thead>
            <tbody>
              {s.recent.map((d, i) => (
                <tr key={`${d.at}-${i}`} className="border-b border-line/60 last:border-0">
                  <td className="px-5 py-2.5 whitespace-nowrap text-muted" title={new Date(d.at).toLocaleString("en-GB", { timeZone: "Europe/London" })}>{ago(d.at)}, {new Date(d.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })}</td>
                  <td className="px-5 py-2.5">
                    {d.customer ? <Link href={adminHref(`customers/${d.customer.id}`)} className="text-accent hover:underline">{d.customer.email}</Link> : <span className="text-muted">Visitor (not signed in)</span>}
                  </td>
                  <td className="px-5 py-2.5">{d.from.replace(/-/g, " ")}</td>
                  <td className="px-5 py-2.5">{d.source ?? <span className="text-muted">Direct / unknown</span>}</td>
                  <td className="px-5 py-2.5">{countryName(d.country)}</td>
                  <td className="px-5 py-2.5 capitalize">{d.device ?? "–"}</td>
                  <td className="px-5 py-2.5 text-muted">{d.version}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-5 pt-3 pb-5 text-sm text-muted">No downloads yet.</p>
        )}
      </section>

      <section className="overflow-x-auto rounded-card border border-line bg-surface">
        <h2 className="px-5 pt-5 text-sm font-semibold">Clicks</h2>
        {s.clicks.length ? (
          <table className="mt-3 w-full min-w-[620px] text-left text-sm">
            <thead className="text-muted">
              <tr className="border-y border-line">
                <th className="px-5 py-2.5 font-medium">What</th>
                <th className="px-5 py-2.5 font-medium">Where on the site · button</th>
                <th className="px-5 py-2.5 text-right font-medium">Clicks</th>
                <th className="px-5 py-2.5 text-right font-medium">People</th>
              </tr>
            </thead>
            <tbody>
              {s.clicks.map((c) => (
                <tr key={`${c.name}|${c.label}`} className="border-b border-line/60 last:border-0">
                  <td className="px-5 py-2.5">{EVENTS[c.name] ?? c.name}</td>
                  <td className="px-5 py-2.5 text-muted">{c.label || "–"}</td>
                  <td className="px-5 py-2.5 text-right font-semibold">{n(c.n)}</td>
                  <td className="px-5 py-2.5 text-right">{n(c.people)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-5 pt-3 pb-5 text-sm text-muted">No clicks recorded yet.</p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <List title="Top pages" rows={s.pages.map((p) => ({ label: p.path, value: p.people, sub: `${n(p.views)} views` }))} />
        <List title="Where visitors came from" rows={[...s.sources.map((r) => ({ label: r.source, value: r.people })), { label: "Direct / unknown", value: Math.max(0, s.visitors - s.sources.reduce((a, r) => a + Number(r.people), 0)) }]} />
        <List title="Countries" rows={s.countries.map((c) => ({ label: countryName(c.country || null), value: c.people }))} />
        <List title="Devices" rows={s.devices.map((d) => ({ label: d.device.charAt(0).toUpperCase() + d.device.slice(1), value: d.people }))} />
      </div>
      <p className="text-xs text-muted">
        Browsers that ask not to be tracked aren&apos;t counted, except their downloads, which are counted without any visitor details. Updates the app installs by itself aren&apos;t downloads here.
      </p>
    </div>
  );
}

function List({ title, rows }: { title: string; rows: { label: string; value: number; sub?: string }[] }) {
  const shown = rows.filter((r) => r.value > 0);
  const max = Math.max(1, ...shown.map((r) => r.value));
  return (
    <figure className="rounded-card border border-line bg-surface p-5">
      <figcaption className="text-sm font-semibold">{title}</figcaption>
      {shown.length ? (
        <dl className="mt-4 flex flex-col gap-3">
          {shown.map((r) => (
            <div key={r.label} title={r.sub}>
              <div className="flex justify-between gap-3 text-sm">
                <dt className="truncate text-muted">{r.label}</dt>
                <dd className="shrink-0 font-semibold">{n(r.value)}</dd>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-surface-2">
                <div className="h-1.5 rounded-full bg-accent" style={{ width: `${(r.value / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-3 text-sm text-muted">Nothing yet.</p>
      )}
      {shown.length > 0 && <p className="mt-3 text-xs text-muted">People</p>}
    </figure>
  );
}
