import "server-only";
import { stripeConfig } from "../config";
import { stripe } from "../stripe";
import type { CustomerRow, CustomerStatus } from "./data";

export interface Bar {
  label: string;
  value: number;
  display: string;
}

export interface DashboardStats {
  mrrCents: number;
  counts: Record<CustomerStatus, number>;
  total: number;
  newThisMonth: number;
  signupsByWeek: Bar[];
  revenueByMonth: Bar[];
  /** Revenue in a currency other than USD (e.g. old test payments), left out of the chart. */
  otherCurrencies: string[];
  recentPaying: CustomerRow[];
}

// Monthly value of each plan, in cents: what "monthly recurring revenue" adds up.
const MONTHLY_VALUE = { monthly: 3000, yearly: 16800 / 12 } as const;
const EXTRA_MONTHLY = { monthly: 500, yearly: 5000 / 12 } as const;
const usd = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

/** Monday 00:00 UTC of the week containing t. */
function weekStart(t: number): number {
  const d = new Date(t);
  const day = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
}

export function customerStats(customers: CustomerRow[], now = Date.now()) {
  const counts: Record<CustomerStatus, number> = { paying: 0, cancelling: 0, past_due: 0, free: 0, trial: 0, unconfirmed: 0 };
  let mrr = 0;
  for (const c of customers) {
    counts[c.status]++;
    if ((c.status === "paying" || c.status === "past_due") && c.plan) mrr += MONTHLY_VALUE[c.plan] + c.extraDevices * EXTRA_MONTHLY[c.plan];
  }
  const thisWeek = weekStart(now);
  const signupsByWeek: Bar[] = Array.from({ length: 12 }, (_, i) => {
    const start = thisWeek - (11 - i) * 7 * 86_400_000;
    const value = customers.filter((c) => {
      const t = Date.parse(c.createdAt);
      return t >= start && t < start + 7 * 86_400_000;
    }).length;
    return { label: new Date(start).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }), value, display: String(value) };
  });
  const monthStart = new Date(now);
  const firstOfMonth = Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 1);
  return {
    counts,
    mrrCents: Math.round(mrr),
    total: customers.length,
    newThisMonth: customers.filter((c) => Date.parse(c.createdAt) >= firstOfMonth).length,
    signupsByWeek,
  };
}

/** Paid invoices for the last 12 months, by month, from Stripe. */
export async function revenueByMonth(now = Date.now()): Promise<{ bars: Bar[]; otherCurrencies: string[] }> {
  const d = new Date(now);
  const months = Array.from({ length: 12 }, (_, i) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 11 + i, 1));
  const totals = new Map<number, number>(months.map((m) => [m, 0]));
  const other = new Set<string>();
  if (stripeConfig) {
    const list = stripe().invoices.list({ status: "paid", created: { gte: Math.floor(months[0] / 1000) }, limit: 100 });
    for await (const inv of list) {
      if (inv.currency !== "usd") {
        other.add(inv.currency.toUpperCase());
        continue;
      }
      const paidAt = (inv.status_transitions?.paid_at ?? inv.created) * 1000;
      const pd = new Date(paidAt);
      const key = Date.UTC(pd.getUTCFullYear(), pd.getUTCMonth(), 1);
      if (totals.has(key)) totals.set(key, totals.get(key)! + inv.amount_paid);
    }
  }
  return {
    bars: months.map((m) => ({ label: new Date(m).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }), value: totals.get(m)!, display: usd(totals.get(m)!) })),
    otherCurrencies: [...other],
  };
}

export async function dashboardStats(customers: CustomerRow[]): Promise<DashboardStats> {
  const base = customerStats(customers);
  const revenue = await revenueByMonth().catch(() => ({ bars: [] as Bar[], otherCurrencies: [] as string[] }));
  return {
    ...base,
    revenueByMonth: revenue.bars,
    otherCurrencies: revenue.otherCurrencies,
    recentPaying: customers.filter((c) => c.status === "paying" || c.status === "past_due" || c.status === "cancelling").slice(0, 6),
  };
}

export const formatUsd = usd;
