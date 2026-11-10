import "server-only";
import { stripeConfig } from "../config";
import { stripe } from "../stripe";
import { supabaseAdmin } from "../supabase/server";
import type { EventName } from "../track";
import type { Bar } from "./stats";
import type { CustomerRow } from "./data";

export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];

interface Raw {
  visitors: number;
  views: number;
  downloads: number;
  downloaders: number;
  days: { day: string; visitors: number; downloads: number }[];
  clicks: { name: EventName; label: string; n: number; people: number }[];
  pages: { path: string; views: number; people: number }[];
  sources: { source: string; people: number }[];
  countries: { country: string; people: number }[];
  devices: { device: string; people: number }[];
}

export interface RecentDownload {
  at: string;
  from: string;
  version: string;
  customer: { id: string; email: string } | null;
  country: string | null;
  device: string | null;
  source: string | null;
}

export interface WebsiteStats extends Omit<Raw, "days"> {
  ready: boolean;
  signups: number;
  connected: number;
  newPaying: number | null;
  visitorBars: Bar[];
  downloadBars: Bar[];
  recent: RecentDownload[];
}

const londonDay = (t: number) => new Date(t).toLocaleDateString("en-CA", { timeZone: "Europe/London" });

/** Day-by-day (7 or 30 days) or week-by-week (90 days) columns, gaps filled with zeros. */
export function bars(days: Raw["days"], period: Period, key: "visitors" | "downloads", now = Date.now()): Bar[] {
  const byDay = new Map(days.map((d) => [d.day, Number(d[key])]));
  const step = period > 31 ? 7 : 1;
  const out: Bar[] = [];
  for (let i = period - step; i >= 0; i -= step) {
    let value = 0;
    for (let j = 0; j < step; j++) value += byDay.get(londonDay(now - (i + j) * 86_400_000)) ?? 0;
    const label = new Date(now - (i + step - 1) * 86_400_000).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
    out.push({ label: step > 1 ? `w/c ${label}` : label, value, display: value.toLocaleString("en-GB") });
  }
  return out;
}

/** New subscriptions in Stripe since `since` that are paying (or being retried). Null without Stripe. */
async function newPayingSince(since: number): Promise<number | null> {
  if (!stripeConfig) return null;
  let n = 0;
  for await (const s of stripe().subscriptions.list({ created: { gte: Math.floor(since / 1000) }, status: "all", limit: 100 })) {
    if (["active", "past_due", "trialing"].includes(s.status)) n++;
  }
  return n;
}

export async function websiteStats(period: Period, customers: CustomerRow[]): Promise<WebsiteStats> {
  const since = Date.now() - period * 86_400_000;
  const db = supabaseAdmin();
  const [stats, recentRows, devices, newPaying] = await Promise.all([
    db.rpc("site_stats", { p_since: new Date(since).toISOString() }),
    db.rpc("site_recent_downloads", { p_limit: 40 }),
    db.from("devices").select("user_id", { count: "exact", head: true }).gte("created_at", new Date(since).toISOString()),
    newPayingSince(since).catch(() => null),
  ]);
  const raw = (stats.data as Raw | null) ?? { visitors: 0, views: 0, downloads: 0, downloaders: 0, days: [], clicks: [], pages: [], sources: [], countries: [], devices: [] };
  const byId = new Map(customers.map((c) => [c.id, c]));
  const recent = ((recentRows.data ?? []) as { at: string; label: string | null; user_id: string | null; country: string | null; device: string | null; source: string | null }[]).map((r) => {
    const [from, version] = (r.label ?? "").split(" · ");
    const c = r.user_id ? byId.get(r.user_id) : undefined;
    return { at: r.at, from: from || "direct", version: version ?? "", customer: c ? { id: c.id, email: c.email } : null, country: r.country, device: r.device, source: r.source };
  });
  const { days, ...rest } = raw;
  return {
    ...rest,
    ready: !stats.error,
    signups: customers.filter((c) => Date.parse(c.createdAt) >= since).length,
    connected: devices.count ?? 0,
    newPaying,
    visitorBars: bars(days, period, "visitors"),
    downloadBars: bars(days, period, "downloads"),
    recent,
  };
}
