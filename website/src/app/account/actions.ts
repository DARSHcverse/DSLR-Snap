"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { appUrl, stripeConfig } from "@/lib/config";
import type { PlanId } from "@/lib/plans";
import { deviceLimit } from "@/lib/appAuth";
import { DELETE_CONFIRMATION, deleteAccount, devicesFor, entitlementFor } from "@/lib/account";
import { emailAccountDeleted, emailExtraComputers } from "@/lib/email/lifecycle";
import { setUpdatesForUser } from "@/lib/email/preferences";
import { EXTRA_COMPUTER, MAX_DEVICES } from "@/lib/plans";
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
  if (!stripeConfig || (plan !== "monthly" && plan !== "yearly")) redirect("/account/billing?error=billing");
  if ((await entitlementFor(user.id)).active) return openBillingPortal();

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: await customerFor(user),
    client_reference_id: user.id,
    line_items: [{ price: stripeConfig.prices[plan], quantity: 1 }],
    subscription_data: { metadata: { user_id: user.id } },
    allow_promotion_codes: true,
    // Charge the advertised USD price; Adaptive Pricing would switch to local currency plus a ~4% fee.
    adaptive_pricing: { enabled: false },
    automatic_tax: { enabled: stripeConfig.automaticTax },
    ...(stripeConfig.automaticTax ? { customer_update: { address: "auto" as const } } : {}),
    success_url: `${appUrl}/account/billing?checkout=done`,
    cancel_url: `${appUrl}/account/billing?tab=plan`,
  });
  redirect(session.url ?? "/account/billing?error=billing");
}

/** Stripe's hosted page for card changes, invoices, switching plan and cancelling. */
export async function openBillingPortal(): Promise<void> {
  const user = await requireUser();
  if (!stripeConfig) redirect("/account/billing?error=billing");
  const portal = await stripe().billingPortal.sessions.create({ customer: await customerFor(user), return_url: `${appUrl}/account/billing` });
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
  redirect("/account/computers");
}

/** Adds or removes one paid extra booth computer (+1 / -1). */
export async function changeExtraComputers(form: FormData): Promise<void> {
  const user = await requireUser();
  const delta = form.get("delta") === "-1" ? -1 : 1;
  const ent = await entitlementFor(user.id);
  if (!ent.active || !ent.plan) redirect("/account/billing");
  // Removing a paid slot that a signed-in computer is using would leave the account over its limit.
  if (delta < 0 && (await devicesFor(user.id)).length > deviceLimit(ent) - 1) redirect("/account/billing?tab=plan&error=remove-computer-first");

  const { data } = await supabaseAdmin()
    .from("subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .in("status", ["active", "trialing", "past_due"])
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) redirect("/account/billing");
  try {
    await setExtraComputers(data.id, ent.plan, ent.extraDevices + delta);
  } catch {
    redirect("/account/billing?tab=plan&error=computers");
  }
  const extra = ent.extraDevices + delta;
  after(() => emailExtraComputers(user.id, { extra, total: MAX_DEVICES + extra, priceEach: EXTRA_COMPUTER[ent.plan!] }));
  redirect("/account/billing?tab=plan");
}

/** Deletes the account for good after the person types DELETE. See deleteAccount for the order. */
export async function deleteMyAccount(form: FormData): Promise<void> {
  const user = await requireUser();
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== DELETE_CONFIRMATION) redirect("/account/settings?error=confirm-delete#delete");
  try {
    await deleteAccount(user.id);
  } catch (e) {
    console.error(`delete account ${user.id}:`, e);
    redirect("/account/settings?error=delete#delete");
  }
  if (user.email) after(() => emailAccountDeleted(user.email));
  await (await supabaseForRequest()).auth.signOut().catch(() => {}); // the login is gone; just clear the cookie
  redirect("/goodbye");
}

/** "Email me about new versions and features" on the account page. */
export async function setUpdateEmails(form: FormData): Promise<void> {
  const user = await requireUser();
  await setUpdatesForUser(user.id, form.get("on") === "1");
  redirect("/account/settings?done=emails#emails");
}

/** The business name the dashboard, emails and the public homepage use. */
export async function saveBusinessName(form: FormData): Promise<void> {
  const user = await requireUser();
  const name = String(form.get("name") ?? "").trim().slice(0, 80) || null;
  await supabaseAdmin().from("customer_profiles").upsert({ user_id: user.id, business_name: name });
  revalidatePath("/account", "layout");
  redirect("/account/settings?done=profile");
}
