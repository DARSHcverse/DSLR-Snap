import "server-only";
import { type Entitlement, entitlementFrom, type SubscriptionRow } from "./appAuth";
import { stripeConfig } from "./config";
import { GALLERY_BUCKET, type GalleryFile } from "./gallery";
import { stripe } from "./stripe";
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

/** Words the person types to confirm deleting their account. */
export const DELETE_CONFIRMATION = "DELETE";

/**
 * Deletes an account for good, in an order where a failure leaves nothing half-done for the person:
 * 1. Cancel any Stripe subscription now, so a deleted account is never charged again.
 * 2. Delete every gallery photo and video from storage.
 * 3. Delete the login, which removes every database row with it (on delete cascade).
 * Stripe keeps the customer and invoices: the law requires keeping payment records (privacy policy).
 */
export async function deleteAccount(userId: string): Promise<void> {
  const db = supabaseAdmin();

  const { data: customer } = await db.from("customers").select("stripe_customer_id").eq("user_id", userId).maybeSingle();
  if (customer && stripeConfig) {
    const subs = await stripe().subscriptions.list({ customer: customer.stripe_customer_id, status: "all", limit: 100 });
    for (const s of subs.data) {
      if (s.status !== "canceled" && s.status !== "incomplete_expired") await stripe().subscriptions.cancel(s.id);
    }
    await stripe().customers.update(customer.stripe_customer_id, { metadata: { user_id: userId, account_deleted: new Date().toISOString() } });
  }

  const paths: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("gallery_sessions").select("files").eq("user_id", userId).range(from, from + 999);
    if (error) throw new Error(`Could not list gallery files: ${error.message}`);
    paths.push(...(data ?? []).flatMap((r) => (r.files as GalleryFile[]).map((f) => f.path)));
    if (!data || data.length < 1000) break;
  }
  for (let i = 0; i < paths.length; i += 1000) {
    const { error } = await db.storage.from(GALLERY_BUCKET).remove(paths.slice(i, i + 1000));
    if (error) throw new Error(`Could not delete gallery files: ${error.message}`);
  }

  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) throw new Error(`Could not delete the login: ${error.message}`);
}
