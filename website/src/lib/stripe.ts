import "server-only";
import Stripe from "stripe";
import { stripeConfig } from "./config";
import type { PlanId } from "./plans";
import { supabaseAdmin } from "./supabase/server";

let client: Stripe | undefined;
export function stripe(): Stripe {
  if (!stripeConfig) throw new Error("Billing is not configured.");
  client ??= new Stripe(stripeConfig.secretKey);
  return client;
}

export function planForPrice(priceId: string | undefined): PlanId | null {
  if (!stripeConfig || !priceId) return null;
  return (Object.entries(stripeConfig.prices).find(([, id]) => id === priceId)?.[0] as PlanId | undefined) ?? null;
}

/**
 * Sets how many extra booth computers the subscription pays for. Stripe prorates the change
 * (charging or crediting the rest of the current period); the webhook then updates the database.
 */
export async function setExtraComputers(subscriptionId: string, plan: PlanId, count: number): Promise<void> {
  const price = stripeConfig?.extraComputer[plan];
  if (!price) throw new Error("Extra computers aren't set up in billing yet.");
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  const item = sub.items.data.find((i) => i.price.id === price);
  const quantity = Math.max(0, Math.min(20, Math.round(count)));
  const items = item
    ? [quantity ? { id: item.id, quantity } : { id: item.id, deleted: true }]
    : quantity
      ? [{ price, quantity }]
      : [];
  if (!items.length) return;
  await stripe().subscriptions.update(subscriptionId, { items, proration_behavior: "create_prorations" });
  await syncSubscription(subscriptionId);
}

/** The Stripe customer for this account, created on first checkout and remembered. */
export async function customerFor(user: { id: string; email: string }): Promise<string> {
  const db = supabaseAdmin();
  const { data } = await db.from("customers").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
  if (data) return data.stripe_customer_id;
  const customer = await stripe().customers.create({ email: user.email, metadata: { user_id: user.id } });
  const { error } = await db.from("customers").insert({ user_id: user.id, stripe_customer_id: customer.id });
  if (error) {
    // Two checkouts at once: keep whichever customer was saved first.
    const again = await db.from("customers").select("stripe_customer_id").eq("user_id", user.id).single();
    if (again.data) return again.data.stripe_customer_id;
    throw new Error(`Could not save customer: ${error.message}`);
  }
  return customer.id;
}

/**
 * Copies a subscription from Stripe into the database. Always re-reads it from Stripe, so webhooks
 * arriving late or out of order can't leave an old status behind.
 */
export async function syncSubscription(subscriptionId: string): Promise<void> {
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const db = supabaseAdmin();

  let userId = sub.metadata.user_id;
  if (!userId) {
    const { data } = await db.from("customers").select("user_id").eq("stripe_customer_id", customerId).maybeSingle();
    userId = data?.user_id;
  }
  if (!userId) throw new Error(`No account for Stripe customer ${customerId}`);

  const items = sub.items.data;
  const periodEnd = items.length ? Math.max(...items.map((i) => i.current_period_end)) : null;
  const base = items.find((i) => planForPrice(i.price.id));
  const priceId = base?.price.id ?? items[0]?.price.id;
  const extraPrices = new Set(Object.values(stripeConfig?.extraComputer ?? {}).filter(Boolean));
  const extraDevices = items.filter((i) => extraPrices.has(i.price.id)).reduce((n, i) => n + (i.quantity ?? 0), 0);
  const { error } = await db.from("subscriptions").upsert({
    id: sub.id,
    user_id: userId,
    status: sub.status,
    plan: planForPrice(priceId),
    price_id: priceId ?? null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end,
    extra_devices: extraDevices,
    updated_at: new Date().toISOString(),
  });
  // 23503: the login no longer exists (account deleted, subscription cancelled with it). Nothing to
  // save; failing would only make Stripe retry for days.
  if (error?.code === "23503") return;
  if (error) throw new Error(`Could not save subscription: ${error.message}`);
}
