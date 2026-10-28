import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BarChart, StatusBars } from "@/components/admin/BarChart";
import { day, STATUS, StatusBadge, Tile } from "@/components/admin/bits";
import { listCustomers } from "@/lib/admin/data";
import { adminHref, requireAdmin } from "@/lib/admin/server";
import { dashboardStats, formatUsd } from "@/lib/admin/stats";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight">Dashboard</h1>
      <Suspense fallback={<p className="mt-6 text-muted">Loading numbers…</p>}>
        <Dashboard />
      </Suspense>
    </>
  );
}

async function Dashboard() {
  await requireAdmin();
  const s = await dashboardStats(await listCustomers());
  const paying = s.counts.paying + s.counts.cancelling + s.counts.past_due;
  const order = ["paying", "cancelling", "past_due", "free", "trial", "unconfirmed"] as const;
  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Monthly recurring revenue" value={formatUsd(s.mrrCents)} sub={`${formatUsd(s.mrrCents * 12)} a year at this rate`} />
        <Tile label="Paying customers" value={String(paying)} sub={s.counts.cancelling ? `${s.counts.cancelling} cancelling` : "none cancelling"} />
        <Tile label="On free trial" value={String(s.counts.trial)} sub={`${s.counts.unconfirmed} haven't confirmed their email`} />
        <Tile label="Accounts" value={String(s.total)} sub={`${s.newThisMonth} new this month · ${s.counts.free} free access`} />
      </div>

      {s.counts.past_due > 0 && (
        <Link href={adminHref("customers?status=past_due")} className="rounded-card border border-bad/40 bg-bad/10 px-5 py-4 text-sm">
          <strong>{s.counts.past_due} failed {s.counts.past_due === 1 ? "payment" : "payments"}</strong>: Stripe is retrying. See who →
        </Link>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <BarChart title="Revenue by month (USD)" bars={s.revenueByMonth} empty="No paid invoices in the last 12 months." />
        <BarChart title="Sign-ups by week" bars={s.signupsByWeek} empty="No sign-ups in the last 12 weeks." />
      </div>
      {s.otherCurrencies.length > 0 && <p className="-mt-3 text-xs text-muted">Not in the revenue chart: payments in {s.otherCurrencies.join(", ")}.</p>}

      <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <StatusBars rows={order.map((k) => ({ label: STATUS[k].label, value: s.counts[k], hint: STATUS[k].hint }))} />
        <section className="rounded-card border border-line bg-surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Paying customers</h2>
            <Link href={adminHref("customers?status=paying")} className="text-sm text-muted hover:text-fg">All →</Link>
          </div>
          {s.recentPaying.length ? (
            <ul className="mt-3 divide-y divide-line/60">
              {s.recentPaying.map((c) => (
                <li key={c.id}>
                  <Link href={adminHref(`customers/${c.id}`)} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-accent">
                    <span className="truncate">{c.email}</span>
                    <span className="flex shrink-0 items-center gap-2 text-muted">
                      {c.plan === "yearly" ? "Yearly" : "Monthly"} · {day(c.periodEnd)}
                      <StatusBadge status={c.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">No paying customers yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
