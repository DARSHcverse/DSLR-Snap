import "server-only";
import type { PlanId } from "./plans";
import { siteUrl } from "./site";

/**
 * Everything accounts and billing need, from environment variables (see .env.example).
 * Each feature switches itself off until its settings exist, so the site builds and runs
 * before the Supabase and Stripe accounts are created.
 */
const env = process.env;

export const supabaseConfig =
  env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ? { url: env.NEXT_PUBLIC_SUPABASE_URL, publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }
    : null;

/** Server-only key that bypasses row-level security. Used after the code has checked who is asking. */
export const supabaseSecretKey = env.SUPABASE_SECRET_KEY ?? "";

export const stripeConfig =
  env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_MONTHLY && env.STRIPE_PRICE_YEARLY
    ? {
        secretKey: env.STRIPE_SECRET_KEY,
        webhookSecret: env.STRIPE_WEBHOOK_SECRET ?? "",
        prices: { monthly: env.STRIPE_PRICE_MONTHLY, yearly: env.STRIPE_PRICE_YEARLY } satisfies Record<PlanId, string>,
        // Extra booth computers; one price per billing interval (Stripe can't mix intervals on one subscription).
        extraComputer: {
          monthly: env.STRIPE_PRICE_EXTRA_COMPUTER_MONTHLY ?? "",
          yearly: env.STRIPE_PRICE_EXTRA_COMPUTER_YEARLY ?? "",
        } satisfies Record<PlanId, string>,
        automaticTax: env.STRIPE_AUTOMATIC_TAX === "1",
      }
    : null;

/** Base64 PKCS#8 DER Ed25519 key; its public half is built into the app. */
export const licencePrivateKey = env.LICENCE_PRIVATE_KEY ?? "";

export const accountsEnabled = !!supabaseConfig;
export const appSignInEnabled = accountsEnabled && !!supabaseSecretKey && !!licencePrivateKey;

/** Where emails and Stripe send people back to. NEXT_PUBLIC_SITE_URL overrides for local testing. */
export const appUrl = (env.NEXT_PUBLIC_SITE_URL || siteUrl).replace(/\/$/, "");
