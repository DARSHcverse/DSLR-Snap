# Switching on accounts, payments and app sign-in

Everything is already built. It stays switched off until these settings exist. Do the steps in order, in **test mode** first: no real money moves until step 6.

## 1. Licence keys (2 minutes)

```bash
cd website
node scripts/generate-licence-keys.mjs
```

It prints two lines:

- **`LICENCE_PRIVATE_KEY=…`**: this goes in Vercel (step 4) **only**. Save a copy in your password manager. If it's lost or changed, every booth is signed out.
- **`MAIN_VITE_LICENCE_PUBLIC_KEY=…`**: this goes in `.env` at the repo root (copy `.env.example`) before you build the Windows installer. It's public, so it's safe to commit if you prefer.

## 2. Supabase (accounts + database)

1. Create a project at supabase.com. Pick a region near you (London for the UK).
2. **SQL editor** → run the four files in `website/supabase/migrations/` in order (`0001` to `0004`). `0003` also creates the private `galleries` storage bucket.
3. **Authentication → URL configuration**:
   - Site URL: `https://dslrsnap.com`
   - Redirect URLs: add `https://dslrsnap.com/auth/callback`, `http://localhost:3000/auth/callback` and your Vercel preview URL pattern (`https://*-<your-team>.vercel.app/auth/callback`)
4. **Authentication → Sign In / Providers**:
   - Email is on by default. Keep "Confirm email" on.
   - Google (optional): create an OAuth client in Google Cloud Console, then paste its client ID and secret here.
5. **Authentication → Emails**: Supabase's built-in email sender is rate-limited. Before launch, set up custom SMTP (for example Resend or Postmark) so sign-up emails arrive reliably.
6. **Project Settings → API Keys**: copy the **publishable** key and a **secret** key.

## 3. Stripe (payments)

1. Create an account at stripe.com. Stay in **Test mode**.

**Shortcut:** put a test secret key (`sk_test_…`) in `website/.env.local` and run `node scripts/setup-stripe.mjs` from `website/`. It does steps 2–4 below and saves the ids and webhook secret into `.env.local`. Run it again with a live key and `--live` when going live.

2. **Product catalog → Add product** "DSLR Snap" with two recurring prices:
   - $30.00 USD every month
   - $168.00 USD every year (shown on the site as $14/month)

   Add a second product, "Extra booth computer", with:
   - $5.00 USD every month
   - $50.00 USD every year

   Copy all four price ids (`price_…`).
3. **Settings → Billing → Customer portal**: turn on cancelling and updating the payment method, and switching plans (add the two "DSLR Snap" prices). Extra computers are added and removed on our Account page, not in the portal. Set the return link to `https://dslrsnap.com/account`.
4. **Developers → Webhooks → Add endpoint**:
   - URL: `https://dslrsnap.com/api/stripe/webhook`
   - Events:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `customer.subscription.paused`
     - `customer.subscription.resumed`
   - Copy the signing secret (`whsec_…`).
5. Optional: **Stripe Tax** (UK VAT / US sales tax). Turn it on in Stripe, then set `STRIPE_AUTOMATIC_TAX=1`.

### Founding-member offer (optional)

No code is needed for this. Checkout already accepts promotion codes.
1. **Product catalog → Coupons → New**: $48 off, duration **Forever**, applies only to the yearly "DSLR Snap" price.
2. **Add a promotion code**: `FOUNDER`, with a limit of 100 redemptions and an expiry date (e.g. 3 months after launch).
3. Founding customers then pay $120 a year ($10/month) for as long as they stay subscribed.

## 4. Vercel

1. **Project → Settings → Environment Variables**: add every name in `website/.env.example`, with values from steps 1 to 3. Use Production and Preview. For `CRON_SECRET`, any long random string works: Vercel sends it to the nightly clean-up that deletes gallery photos older than a year.
2. **Domains**: add `dslrsnap.com` and follow the DNS instructions at your registrar.
3. Redeploy. "Sign in" and "Start free" now appear on the site.

## 5. Test the whole flow (test mode)

1. On the website: Start free → create an account → confirm the email → Account page → Choose yearly. Pay with the test card `4242 4242 4242 4242`, any future date and any CVC.
2. Account shows **Yearly plan · renews on …**. If not, check Stripe → Webhooks for failed deliveries.
3. On the booth PC: put the public key in `.env` → `npm run dev` → Operator → **Account → Sign in**.
   - The browser opens → "Open DSLR Snap" → the app shows **Licensed**.
   - If the browser can't open the app, type the 8-letter code shown on the page.
4. Take a session: no watermark. Sign out: the next session has the "DSLR Snap · trial" band.
5. Sign in on a third computer: it should be refused with "already in use on 2 computers". On the website, Account → Remove one → sign in again works.
8. Cancel in the billing portal: the plan shows "ends on …". After that date, the booth goes back to trial.

## 6. Going live

- Stripe: switch to live mode and create the same product, prices and webhook there. Replace the four Stripe values in Vercel's Production environment.
- Stripe requires **Terms, Privacy and Refund** pages on the site before live payments. (Not written yet.)
- Windows installer: code-sign it (Azure Trusted Signing). This avoids the "unknown publisher" warning and keeps the tamper protection meaningful.

## How it fits together

| Piece | Where | What it does |
|---|---|---|
| Accounts | Supabase Auth | Email and password, or Google |
| Plan status | `subscriptions` table | Written **only** by the Stripe webhook; the browser can't fake a payment |
| App sign-in | `/app/sign-in` → `dslrsnap://auth` → `/api/app/token` | One-time code, locked to the app that asked for it (PKCE) |
| Computer limit | `claim_device()` in the database | 2 per account plus any paid extras, atomic. Signing in again on the same PC replaces its old token |
| Licence | Signed by the website, checked by the app offline | Tied to one computer; 14 days offline; trial watermark without a plan |
| Cloud gallery | `/api/app/uploads` → signed upload links → `/s/<session>` and `/e/<link>` | Only signed-in booths with an active plan can upload; the booth holds no storage key. Photos stay private (short-lived signed links) and are deleted after a year |
| Tamper protection | Electron fuses in `electron-builder.yml` | The installed app refuses to start if its code was edited |
