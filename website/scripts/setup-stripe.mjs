// Creates DSLR Snap's Stripe setup and writes the ids into .env.local. Safe to run again: it reuses
// what already exists (prices are found by lookup key, the webhook by URL).
//   node scripts/setup-stripe.mjs            → test mode (refuses a live key)
//   node scripts/setup-stripe.mjs --live     → live mode, once you're ready to take real payments
// Never prints secret values; the webhook signing secret goes straight into .env.local.
import { readFileSync, writeFileSync } from "node:fs";
import Stripe from "stripe";

const ENV_FILE = new URL("../.env.local", import.meta.url);
const SITE = process.env.SETUP_SITE_URL || "https://dslrsnap.com";
const live = process.argv.includes("--live");

const envText = readFileSync(ENV_FILE, "utf8");
const key = envText.match(/^STRIPE_SECRET_KEY=(.*)$/m)?.[1].trim();
if (!key) throw new Error("STRIPE_SECRET_KEY is empty in website/.env.local");
const isLive = /^(sk|rk)_live_/.test(key);
if (isLive && !live) throw new Error("That's a live key (real payments). Use a test key (sk_test_), or pass --live on purpose.");
if (!isLive && live) throw new Error("--live was passed with a test key.");
const stripe = new Stripe(key);

const PRODUCTS = [
  {
    name: "DSLR Snap",
    description: "Photo booth software for Windows. Every feature, 2 booth computers.",
    prices: [
      { env: "STRIPE_PRICE_MONTHLY", lookup: "dslrsnap_monthly", amount: 3000, interval: "month", nickname: "Monthly" },
      { env: "STRIPE_PRICE_YEARLY", lookup: "dslrsnap_yearly", amount: 16800, interval: "year", nickname: "Yearly ($14/month)" },
    ],
  },
  {
    name: "Extra booth computer",
    description: "One more computer signed in to DSLR Snap.",
    prices: [
      { env: "STRIPE_PRICE_EXTRA_COMPUTER_MONTHLY", lookup: "dslrsnap_extra_monthly", amount: 500, interval: "month", nickname: "Extra computer, monthly" },
      { env: "STRIPE_PRICE_EXTRA_COMPUTER_YEARLY", lookup: "dslrsnap_extra_yearly", amount: 5000, interval: "year", nickname: "Extra computer, yearly" },
    ],
  },
];

// Must match SUBSCRIPTION_EVENTS + checkout in src/app/api/stripe/webhook/route.ts.
const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  // Emails only (src/lib/email/lifecycle.ts): failed payments and yearly renewal reminders.
  "invoice.payment_failed",
  "invoice.upcoming",
];

const out = {};

for (const p of PRODUCTS) {
  const existing = await stripe.prices.list({ lookup_keys: p.prices.map((x) => x.lookup), expand: ["data.product"], limit: 10 });
  let productId = existing.data.map((x) => x.product).find((x) => x && !x.deleted)?.id;
  if (!productId) {
    productId = (await stripe.products.create({ name: p.name, description: p.description, tax_code: "txcd_10202000" })).id;
    console.log(`Created product "${p.name}" (${productId})`);
  } else console.log(`Product "${p.name}" already exists (${productId})`);

  for (const price of p.prices) {
    const found = existing.data.find((x) => x.lookup_key === price.lookup);
    if (found && found.unit_amount === price.amount && found.recurring?.interval === price.interval && found.active) {
      out[price.env] = found.id;
      console.log(`  ${price.nickname}: already there (${found.id})`);
      continue;
    }
    // Wrong amount or archived: make a new price and move the lookup key to it.
    const created = await stripe.prices.create({
      product: productId,
      currency: "usd",
      unit_amount: price.amount,
      recurring: { interval: price.interval },
      nickname: price.nickname,
      lookup_key: price.lookup,
      transfer_lookup_key: true,
      tax_behavior: "exclusive",
    });
    out[price.env] = created.id;
    console.log(`  ${price.nickname}: created $${price.amount / 100}/${price.interval} (${created.id})`);
  }
}

// Customer portal: cancel, update card, invoices, switch between the two main plans.
const portalFeatures = {
  customer_update: { enabled: true, allowed_updates: ["email", "address", "tax_id"] },
  invoice_history: { enabled: true },
  payment_method_update: { enabled: true },
  subscription_cancel: { enabled: true, mode: "at_period_end", cancellation_reason: { enabled: true, options: ["too_expensive", "unused", "switched_service", "missing_features", "other"] } },
  subscription_update: {
    enabled: true,
    default_allowed_updates: ["price"],
    proration_behavior: "create_prorations",
    products: [{ product: (await stripe.prices.retrieve(out.STRIPE_PRICE_MONTHLY)).product, prices: [out.STRIPE_PRICE_MONTHLY, out.STRIPE_PRICE_YEARLY] }],
  },
};
const portalSettings = {
  business_profile: { headline: "Manage your DSLR Snap plan", privacy_policy_url: `${SITE}/privacy`, terms_of_service_url: `${SITE}/terms` },
  default_return_url: `${SITE}/account`,
  features: portalFeatures,
};
const portals = await stripe.billingPortal.configurations.list({ is_default: true, limit: 1 });
if (portals.data[0]) {
  await stripe.billingPortal.configurations.update(portals.data[0].id, portalSettings);
  console.log(`Customer portal updated (${portals.data[0].id})`);
} else {
  const created = await stripe.billingPortal.configurations.create(portalSettings);
  console.log(`Customer portal created (${created.id}${created.is_default ? ", default" : ""})`);
}

// Webhook. Stripe only reveals the signing secret on creation, so an existing endpoint keeps the
// secret already in .env.local; if that's empty, the endpoint is replaced to get a fresh one.
const url = `${SITE}/api/stripe/webhook`;
const currentSecret = envText.match(/^STRIPE_WEBHOOK_SECRET=(.*)$/m)?.[1].trim();
const hooks = (await stripe.webhookEndpoints.list({ limit: 100 })).data.filter((h) => h.url === url);
if (hooks.length && currentSecret) {
  await stripe.webhookEndpoints.update(hooks[0].id, { enabled_events: WEBHOOK_EVENTS, disabled: false });
  console.log(`Webhook already there (${hooks[0].id}); events checked, secret kept`);
} else {
  for (const h of hooks) await stripe.webhookEndpoints.del(h.id);
  const hook = await stripe.webhookEndpoints.create({ url, enabled_events: WEBHOOK_EVENTS, description: "DSLR Snap website" });
  out.STRIPE_WEBHOOK_SECRET = hook.secret;
  console.log(`Webhook created for ${url} (${hook.id}); signing secret saved to .env.local`);
}

let next = envText;
for (const [name, value] of Object.entries(out)) {
  next = next.match(new RegExp(`^${name}=.*$`, "m")) ? next.replace(new RegExp(`^${name}=.*$`, "m"), `${name}=${value}`) : `${next}\n${name}=${value}\n`;
}
writeFileSync(ENV_FILE, next, { mode: 0o600 });
console.log(`\nSaved to website/.env.local: ${Object.keys(out).join(", ")}`);
