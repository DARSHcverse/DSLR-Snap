import "server-only";
import type { User } from "@supabase/supabase-js";
import { type Entitlement, entitlementFrom, type SubscriptionRow, withComplimentary } from "../appAuth";
import { stripeConfig } from "../config";
import { stripe } from "../stripe";
import { supabaseAdmin } from "../supabase/server";

/** What the admin shows for each account. */
export type CustomerStatus = "paying" | "cancelling" | "past_due" | "free" | "trial" | "unconfirmed";

export interface CustomerRow {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  confirmed: boolean;
  provider: string;
  status: CustomerStatus;
  plan: "monthly" | "yearly" | null;
  periodEnd: number | null;
  extraDevices: number;
  devices: number;
  comp: { active: boolean; until: string | null; devices: number; note: string | null };
  adminNote: string | null;
  stripeCustomerId: string | null;
  subscriptionStatus: string | null;
}

interface SubRow extends SubscriptionRow {
  id: string;
  user_id: string;
}
interface ProfileRow {
  user_id: string;
  comp_active: boolean;
  comp_until: string | null;
  comp_devices: number;
  comp_note: string | null;
  admin_note: string | null;
}

async function allUsers(): Promise<User[]> {
  const db = supabaseAdmin();
  const users: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Could not list users: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

export function statusFor(ent: Entitlement, sub: SubRow | undefined, confirmed: boolean): CustomerStatus {
  if (ent.complimentary) return "free";
  if (ent.active) return sub?.status === "past_due" ? "past_due" : ent.cancelAtPeriodEnd ? "cancelling" : "paying";
  return confirmed ? "trial" : "unconfirmed";
}

/** Every account with its plan, free access and computers. Newest first. */
export async function listCustomers(): Promise<CustomerRow[]> {
  const db = supabaseAdmin();
  const [users, subs, profiles, devices, customers] = await Promise.all([
    allUsers(),
    db.from("subscriptions").select("id, user_id, status, plan, current_period_end, cancel_at_period_end, extra_devices"),
    db.from("customer_profiles").select("user_id, comp_active, comp_until, comp_devices, comp_note, admin_note"),
    db.from("devices").select("user_id").is("revoked_at", null),
    db.from("customers").select("user_id, stripe_customer_id"),
  ]);
  const now = Date.now();
  const subsBy = new Map<string, SubRow[]>();
  for (const s of (subs.data ?? []) as SubRow[]) subsBy.set(s.user_id, [...(subsBy.get(s.user_id) ?? []), s]);
  const profileBy = new Map(((profiles.data ?? []) as ProfileRow[]).map((p) => [p.user_id, p]));
  const deviceCount = new Map<string, number>();
  for (const d of devices.data ?? []) deviceCount.set(d.user_id, (deviceCount.get(d.user_id) ?? 0) + 1);
  const stripeBy = new Map((customers.data ?? []).map((c) => [c.user_id as string, c.stripe_customer_id as string]));

  return users
    .map((u) => {
      const rows = subsBy.get(u.id) ?? [];
      const p = profileBy.get(u.id);
      const ent = withComplimentary(entitlementFrom(rows, now), p ? { active: p.comp_active, until: p.comp_until, devices: p.comp_devices } : null, now);
      const latest = [...rows].sort((a, b) => Date.parse(b.current_period_end ?? "0") - Date.parse(a.current_period_end ?? "0"))[0];
      const confirmed = !!u.email_confirmed_at;
      return {
        id: u.id,
        email: u.email ?? "(no email)",
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        confirmed,
        provider: (u.app_metadata?.provider as string) ?? "email",
        status: statusFor(ent, latest, confirmed),
        plan: ent.complimentary ? null : (ent.plan ?? latest?.plan ?? null),
        periodEnd: ent.periodEnd,
        extraDevices: ent.complimentary ? 0 : ent.extraDevices,
        devices: deviceCount.get(u.id) ?? 0,
        comp: { active: !!p?.comp_active, until: p?.comp_until ?? null, devices: p?.comp_devices ?? 2, note: p?.comp_note ?? null },
        adminNote: p?.admin_note ?? null,
        stripeCustomerId: stripeBy.get(u.id) ?? null,
        subscriptionStatus: latest?.status ?? null,
      } satisfies CustomerRow;
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export interface CustomerDetail {
  row: CustomerRow;
  devices: { id: string; name: string; created_at: string; last_seen_at: string | null }[];
  galleries: { events: number; sessions: number };
  invoices: { id: string; date: number; amount: number; currency: string; status: string; url: string | null }[];
  subscriptionId: string | null;
  audit: { at: string; action: string; detail: Record<string, unknown> }[];
}

export async function customerDetail(id: string): Promise<CustomerDetail | null> {
  const row = (await listCustomers()).find((c) => c.id === id);
  if (!row) return null;
  const db = supabaseAdmin();
  const [devices, events, sessions, sub, audit] = await Promise.all([
    db.from("devices").select("id, name, created_at, last_seen_at").eq("user_id", id).is("revoked_at", null).order("created_at"),
    db.from("gallery_events").select("id", { count: "exact", head: true }).eq("user_id", id),
    db.from("gallery_sessions").select("id", { count: "exact", head: true }).eq("user_id", id),
    db.from("subscriptions").select("id").eq("user_id", id).in("status", ["active", "trialing", "past_due"]).order("current_period_end", { ascending: false }).limit(1).maybeSingle(),
    db.from("admin_audit").select("at, action, detail").eq("user_id", id).order("at", { ascending: false }).limit(30),
  ]);
  let invoices: CustomerDetail["invoices"] = [];
  if (row.stripeCustomerId && stripeConfig) {
    const list = await stripe().invoices.list({ customer: row.stripeCustomerId, limit: 12 }).catch(() => null);
    invoices = (list?.data ?? []).map((i) => ({ id: i.id ?? "", date: i.created * 1000, amount: i.amount_paid || i.amount_due, currency: i.currency, status: i.status ?? "", url: i.hosted_invoice_url ?? null }));
  }
  return {
    row,
    devices: devices.data ?? [],
    galleries: { events: events.count ?? 0, sessions: sessions.count ?? 0 },
    invoices,
    subscriptionId: sub.data?.id ?? null,
    audit: (audit.data ?? []) as CustomerDetail["audit"],
  };
}
