import "server-only";
import { type Entitlement, entitlementFrom, type SubscriptionRow } from "./appAuth";
import { supabaseAdmin } from "./supabase/server";

/** Whether this account has a paid plan right now. Read from the Stripe mirror, never from the browser. */
export async function entitlementFor(userId: string): Promise<Entitlement> {
  const { data, error } = await supabaseAdmin()
    .from("subscriptions")
    .select("status, plan, current_period_end, cancel_at_period_end, extra_devices")
    .eq("user_id", userId);
  if (error) throw new Error(`Could not read subscription: ${error.message}`);
  return entitlementFrom((data ?? []) as SubscriptionRow[], Date.now());
}

export interface DeviceRow {
  id: string;
  name: string;
  created_at: string;
  last_seen_at: string | null;
}

export async function devicesFor(userId: string): Promise<DeviceRow[]> {
  const { data } = await supabaseAdmin()
    .from("devices")
    .select("id, name, created_at, last_seen_at")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("created_at");
  return (data ?? []) as DeviceRow[];
}
