"use server";

import { redirect } from "next/navigation";
import { appUrl, stripeConfig } from "@/lib/config";
import type { PlanId } from "@/lib/plans";
import { deviceLimit } from "@/lib/appAuth";
import { DELETE_CONFIRMATION, deleteAccount, devicesFor, entitlementFor } from "@/lib/account";
import { customerFor, setExtraComputers, stripe } from "@/lib/stripe";
import { getCurrentUser, supabaseAdmin, supabaseForRequest } from "@/lib/supabase/server";

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  return user;
}

/** Stripe Checkout for a plan. An account that already pays goes to the billing portal instead of paying twice. */
export async function startCheckout(form: FormData): Promise<void> {
  const user = await requireUser();
  const plan = form.get("plan") as PlanId;
  if (!stripeConfig || (plan !== "monthly" && plan !== "yearly")) redirect("/account?error=billing");
  if ((await entitlementFor(user.id)).active) return openBillingPortal();

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: await customerFor(user),
    client_reference_id: user.id,
    line_items: [{ price: stripeConfig.prices[plan], quantity: 1 }],
    subscription_data: { metadata: { user_id: user.id } },
    allow_promotion_codes: true,
    automatic_tax: { enabled: stripeConfig.automaticTax },
    ...(stripeConfig.automaticTax ? { customer_update: { address: "auto" as const } } : {}),
    success_url: `${appUrl}/account?checkout=done`,
    cancel_url: `${appUrl}/account`,
  });
  redirect(session.url ?? "/account?error=billing");
}

/** Stripe's hosted page for card changes, invoices, switching plan and cancelling. */
export async function openBillingPortal(): Promise<void> {
  const user = await requireUser();
  if (!stripeConfig) redirect("/account?error=billing");
  const portal = await stripe().billingPortal.sessions.create({ customer: await customerFor(user), return_url: `${appUrl}/account` });
  redirect(portal.url);
}

/** Frees a booth computer slot. That computer drops to trial the next time it checks in. */
export async function removeDevice(form: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  await supabaseAdmin()
    .from("devices")
    .update({ revoked_at: new Date().toISOString(), refresh_token_hash: null })
    .eq("id", id)
    .eq("user_id", user.id); // only the owner's own computers
  redirect("/account");
}

/** Adds or removes one paid extra booth computer (+1 / -1). */
export async function changeExtraComputers(form: FormData): Promise<void> {
  const user = await requireUser();
  const delta = form.get("delta") === "-1" ? -1 : 1;
  const ent = await entitlementFor(user.id);
  if (!ent.active || !ent.plan) redirect("/account");
  // Removing a paid slot that a signed-in computer is using would leave the account over its limit.
  if (delta < 0 && (await devicesFor(user.id)).length > deviceLimit(ent) - 1) redirect("/account?error=remove-computer-first");

  const { data } = await supabaseAdmin()
    .from("subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .in("status", ["active", "trialing", "past_due"])
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) redirect("/account");
  try {
    await setExtraComputers(data.id, ent.plan, ent.extraDevices + delta);
  } catch {
    redirect("/account?error=computers");
  }
  redirect("/account");
}

/** Deletes the account for good after the person types DELETE. See deleteAccount for the order. */
export async function deleteMyAccount(form: FormData): Promise<void> {
  const user = await requireUser();
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== DELETE_CONFIRMATION) redirect("/account?error=confirm-delete#delete");
  try {
    await deleteAccount(user.id);
  } catch (e) {
    console.error(`delete account ${user.id}:`, e);
    redirect("/account?error=delete#delete");
  }
  await (await supabaseForRequest()).auth.signOut().catch(() => {}); // the login is gone; just clear the cookie
  redirect("/goodbye");
}
