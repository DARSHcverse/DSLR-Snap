import "server-only";
import { stripeConfig } from "./config";
import { stripe } from "./stripe";
import { supabaseAdmin } from "./supabase/server";

export interface BillingDetails {
  card: { brand: string; last4: string; expires: string } | null;
  invoices: { id: string; date: number; amount: string; status: string; url: string | null }[];
}

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

/**
 * The card on file and recent invoices, read from Stripe for the billing page. Empty when the
 * account never paid or Stripe can't be reached: the page still works, it just shows less.
 */
export async function billingDetails(userId: string): Promise<BillingDetails> {
  const empty: BillingDetails = { card: null, invoices: [] };
  if (!stripeConfig) return empty;
  const { data } = await supabaseAdmin().from("customers").select("stripe_customer_id").eq("user_id", userId).maybeSingle();
  if (!data) return empty;
  try {
    const [methods, invoices] = await Promise.all([
      stripe().paymentMethods.list({ customer: data.stripe_customer_id, type: "card", limit: 1 }),
      stripe().invoices.list({ customer: data.stripe_customer_id, limit: 12 }),
    ]);
    const c = methods.data[0]?.card;
    return {
      card: c ? { brand: c.brand, last4: c.last4, expires: `${String(c.exp_month).padStart(2, "0")}/${String(c.exp_year).slice(-2)}` } : null,
      invoices: invoices.data.flatMap((i) =>
        i.id && i.status !== "draft" ? [{ id: i.id, date: i.created * 1000, amount: money(i.total, i.currency), status: i.status ?? "open", url: i.hosted_invoice_url ?? null }] : [],
      ),
    };
  } catch (e) {
    console.error("billing details:", e);
    return empty;
  }
}
