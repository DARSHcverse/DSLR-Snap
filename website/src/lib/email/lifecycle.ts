import "server-only";
import type Stripe from "stripe";
import { planForPrice } from "../stripe";
import { productionUrl } from "../site";
import { supabaseAdmin } from "../supabase/server";
import { emailForUser, sendEmail, TEAM_EMAIL } from "./send";
import * as t from "./templates";

/**
 * Every "something happened → send these emails" rule lives here, so the triggers are in one
 * place. Each send has a once-key, so retried webhooks and repeat sign-ins never send twice.
 */

/** First confirmed sign-in (email link or Google): welcome the customer, tell the team. */
export async function welcomeIfNew(user: { id: string; email?: string; email_confirmed_at?: string | null; app_metadata?: { provider?: string } }) {
  if (!user.email || !user.email_confirmed_at) return;
  const db = supabaseAdmin();
  const { data } = await db.from("customer_profiles").select("welcomed_at").eq("user_id", user.id).maybeSingle();
  if (data?.welcomed_at) return;
  await db.from("customer_profiles").upsert({ user_id: user.id, welcomed_at: new Date().toISOString() });
  await sendEmail({ to: user.email, email: t.welcome(), template: "welcome", onceKey: `welcome:${user.id}` });
  await sendEmail({
    to: TEAM_EMAIL,
    email: t.teamNotice({ title: "New sign-up", facts: [["Email", user.email], ["Signed up with", user.app_metadata?.provider === "google" ? "Google" : "Email"]] }),
    template: "team-signup",
    onceKey: `team-signup:${user.id}`,
  });
}

/** The account behind a Stripe customer: metadata first, then our customers table. */
async function accountFor(customerId: string, metadataUser?: string): Promise<{ userId: string; email: string } | null> {
  let userId = metadataUser;
  if (!userId) {
    const { data } = await supabaseAdmin().from("customers").select("user_id").eq("stripe_customer_id", customerId).maybeSingle();
    userId = data?.user_id;
  }
  if (!userId) return null;
  const email = await emailForUser(userId);
  return email ? { userId, email } : null; // no login any more: the account was deleted
}

const periodEnd = (sub: Stripe.Subscription) => Math.max(0, ...sub.items.data.map((i) => i.current_period_end)) * 1000;
const planOf = (sub: Stripe.Subscription) => sub.items.data.map((i) => planForPrice(i.price.id)).find(Boolean) ?? null;

/** Stripe webhook events → customer and team emails. Called after the subscription is synced. */
export async function emailsForStripeEvent(event: Stripe.Event, stripe: Stripe): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      if (!s.subscription || !s.customer) return;
      const sub = await stripe.subscriptions.retrieve(typeof s.subscription === "string" ? s.subscription : s.subscription.id);
      const who = await accountFor(typeof s.customer === "string" ? s.customer : s.customer.id, sub.metadata.user_id);
      const plan = planOf(sub);
      if (!who || !plan) return;
      await sendEmail({ to: who.email, email: t.planStarted({ plan, amountCents: s.amount_total ?? 0, renewsAt: periodEnd(sub) }), template: "plan-started", onceKey: `plan-started:${s.id}` });
      await sendEmail({
        to: TEAM_EMAIL,
        email: t.teamNotice({ title: "New paying customer 🎉", facts: [["Email", who.email], ["Plan", plan === "yearly" ? "Yearly" : "Monthly"], ["Paid", t.usd(s.amount_total ?? 0)]] }),
        template: "team-paid",
        onceKey: `team-paid:${s.id}`,
      });
      return;
    }
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      if (!inv.customer) return;
      const who = await accountFor(typeof inv.customer === "string" ? inv.customer : inv.customer.id);
      if (!who) return;
      const key = `${inv.id}:${inv.attempt_count}`;
      await sendEmail({ to: who.email, email: t.paymentFailed({ amountCents: inv.amount_due, nextTry: inv.next_payment_attempt ? inv.next_payment_attempt * 1000 : null }), template: "payment-failed", onceKey: `payment-failed:${key}` });
      await sendEmail({
        to: TEAM_EMAIL,
        email: t.teamNotice({ title: "Payment failed", facts: [["Email", who.email], ["Amount", t.usd(inv.amount_due)], ["Attempt", String(inv.attempt_count)]] }),
        template: "team-payment-failed",
        onceKey: `team-payment-failed:${key}`,
      });
      return;
    }
    case "invoice.upcoming": {
      // Stripe sends this a set number of days before renewal (Billing settings). Monthly plans renew
      // too often for a reminder to help, so only yearly ones get it.
      const inv = event.data.object as Stripe.Invoice;
      const yearly = inv.lines.data.some((l) => l.pricing?.price_details?.price && planForPrice(l.pricing.price_details.price as string) === "yearly");
      if (!yearly || !inv.customer) return;
      const who = await accountFor(typeof inv.customer === "string" ? inv.customer : inv.customer.id);
      if (!who) return;
      const renewsAt = (inv.next_payment_attempt ?? inv.period_end) * 1000;
      await sendEmail({ to: who.email, email: t.renewalReminder({ amountCents: inv.amount_due, renewsAt }), template: "renewal-reminder", onceKey: `renewal:${who.userId}:${inv.period_end}` });
      return;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const before = (event.data.previous_attributes ?? {}) as Partial<Stripe.Subscription>;
      const nowCancelling = sub.cancel_at_period_end || !!sub.cancel_at;
      const wasCancelling = before.cancel_at_period_end === true || !!before.cancel_at;
      const changed = "cancel_at_period_end" in before || "cancel_at" in before;
      if (!changed || !nowCancelling || wasCancelling) return;
      const who = await accountFor(typeof sub.customer === "string" ? sub.customer : sub.customer.id, sub.metadata.user_id);
      if (!who) return;
      const endsAt = (sub.cancel_at ?? 0) * 1000 || periodEnd(sub);
      await sendEmail({ to: who.email, email: t.cancellationScheduled({ endsAt }), template: "cancel-scheduled", onceKey: `cancel:${sub.id}:${endsAt}` });
      await sendEmail({
        to: TEAM_EMAIL,
        email: t.teamNotice({ title: "Customer cancelled", facts: [["Email", who.email], ["Plan", planOf(sub) === "yearly" ? "Yearly" : "Monthly"], ["Access until", new Date(endsAt).toLocaleDateString("en-GB")]] }),
        template: "team-cancel",
        onceKey: `team-cancel:${sub.id}:${endsAt}`,
      });
      return;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const who = await accountFor(typeof sub.customer === "string" ? sub.customer : sub.customer.id, sub.metadata.user_id);
      if (!who) return; // deleted accounts get the account-deleted email instead
      await sendEmail({ to: who.email, email: t.planEnded(), template: "plan-ended", onceKey: `ended:${sub.id}` });
      await sendEmail({ to: TEAM_EMAIL, email: t.teamNotice({ title: "Plan ended", facts: [["Email", who.email]] }), template: "team-ended", onceKey: `team-ended:${sub.id}` });
      return;
    }
  }
}

export async function emailExtraComputers(userId: string, o: { extra: number; total: number; priceEach: string }) {
  const email = await emailForUser(userId);
  if (email) await sendEmail({ to: email, email: t.extraComputersChanged(o), template: "computers-changed" });
}

export async function emailNewDevice(userId: string, device: string) {
  const email = await emailForUser(userId);
  if (email) await sendEmail({ to: email, email: t.newDeviceSignedIn({ device, at: Date.now() }), template: "new-device" });
}

export async function emailAccountDeleted(email: string) {
  await sendEmail({ to: email, email: t.accountDeleted(), template: "account-deleted" });
  await sendEmail({ to: TEAM_EMAIL, email: t.teamNotice({ title: "Account deleted", facts: [["Email", email]] }), template: "team-deleted" });
}

/** The unsubscribe link for update emails (creates the profile row if needed). */
export async function unsubscribeUrlFor(userId: string): Promise<string> {
  const db = supabaseAdmin();
  let { data } = await db.from("customer_profiles").select("unsubscribe_token").eq("user_id", userId).maybeSingle();
  if (!data) ({ data } = await db.from("customer_profiles").upsert({ user_id: userId }).select("unsubscribe_token").single());
  return `${productionUrl}/email/unsubscribe?t=${data!.unsubscribe_token}`;
}
