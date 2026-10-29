# To do before launch

Everything that's left, from a full review of the app and website (27 October 2026, updated 28 October). Nothing below needs new code unless it's under "Still to build".

## 1. Accounts and credentials (you)

Set up in test mode on 28 October 2026 and checked end to end (sign-up, Google, $168 test payment, app sign-in, licence). Step-by-step: [ACCOUNTS_SETUP.md](ACCOUNTS_SETUP.md).

- [x] **Domain**: dslrsnap.com on Vercel (www redirects to it); downloads.dslrsnap.com on R2
- [ ] **Inboxes**: confirm hello@ and support@dslrsnap.com receive mail (Cloudflare Email Routing MX records exist)
- [x] **Licence keys** generated: private key in Vercel, public key in the app's `.env`
- [ ] **Copy `LICENCE_PRIVATE_KEY` into a password manager** (losing it signs every booth out)
- [x] **Supabase**: project, migrations `0001`–`0004`, gallery bucket, redirect URLs, Google sign-in
- [ ] **Supabase custom SMTP** (Authentication → Emails → SMTP, e.g. Resend): the built-in sender only sends a few emails an hour, so sign-up confirmations will fail at launch volume
- [x] **Stripe test mode**: products, prices, portal, webhook (`website/scripts/setup-stripe.mjs`); checkout charges USD only
- [ ] **Stripe branding** (logo, icon, #FF7A59) and archive the unused duplicate price `dslrsnap_extra_device_yearly`; optional Stripe Tax; optional `FOUNDER` code
- [x] **Vercel environment variables**
- [x] **Resend** key added and DNS records in place
- [ ] **Send a test message** through dslrsnap.com/support#contact and confirm it arrives
- [ ] **Google Search Console**: domain verified by DNS record; submit `https://dslrsnap.com/sitemap.xml`
- [x] **End-to-end test**: sign up, Google, pay with the test card, sign the app in
- [ ] **Still to test**: QR gallery and host gallery from a real session, Add a computer, cancel in the billing portal, Delete account in the browser
- [ ] **Stripe live mode** (launch day): `node scripts/setup-stripe.mjs --live` with a live secret key, then put the live values in Vercel

## 2. Business and legal (you)

- [ ] **Business details** in `website/src/lib/site.ts` → `business`: legal name, company number, VAT number (when registered), address; confirm country and governing law. They fill the footer, Terms and Privacy automatically
- [ ] **Solicitor review** of the Terms, Privacy and Refund pages. They're drafted to match how the product really handles data, but they aren't legal advice. Also confirm the refund promise (14 days on a first yearly payment)
- [ ] **ICO registration** (UK data protection fee). Required for businesses handling personal data, and the cloud gallery stores guests' photos
- [ ] **Make the GitHub repo private** (Settings → Danger Zone → Change visibility). Nikon's and Canon's SDK terms treat their APIs and documentation as confidential, and it's also your product's source code
- [ ] **Canon EDSDK redistribution**: confirm the licence lets you ship EDSDK.dll and EdsImage.dll inside a paid installer
- [ ] **Nikon SDK (accepted 28 Oct 2026)**: shipping Nikon's files inside DSLR Snap is allowed (2.1). The Terms of service must pass on Nikon's restrictions, warranty disclaimers and liability limits, naming Nikon as a third-party beneficiary. A first draft is in the Terms ("Camera makers' software"); have the solicitor check it along with the indemnity (clause 5)
- [ ] **Trademark check** on "DSLR Snap" before spending on branding
- [ ] **Code-signing certificate** for the Windows installer (e.g. Azure Trusted Signing, ~$10/month). Without it, Windows shows "unknown publisher" warnings
- [ ] **VAT**: watch the registration threshold; Stripe Tax can collect it once registered

## 3. Marketing (you)

- [ ] Social profiles (Instagram, Facebook, YouTube, TikTok) → add the URLs to `site.social` and they appear in the footer and structured data
- [ ] **Real screenshots and a demo video** of the app (the site uses illustrations today): booth screen, glam print, a 360 clip
- [ ] Testimonials from the first operators
- [ ] Decide on the **founding-member offer** ($10/month for the first 100); the coupon setup is in ACCOUNTS_SETUP.md
- [ ] Re-check dslrBooth's prices before launch (the comparison page says "checked October 2026")
- [ ] Email list / newsletter tool (not set up)

## 4. Hardware checks on the Windows laptop (you, with me)

Full checklist with tick boxes: [HARDWARE_SETUP.md](HARDWARE_SETUP.md) (34 open checks). The ones that can only be confirmed on real hardware:

- [ ] Pull, `npm install`, `npm run fetch-models` (AI model and Windows ffmpeg)
- [ ] **Printer auto-detection**: rename the DNP printer back to its original name and confirm "Automatic" finds it; test print 4×6 and 2×6
- [ ] **2×6 strip cutting**: run `powershell -ExecutionPolicy Bypass -File scripts\printer-info.ps1` and send `dnp-printer-info.txt`, so the app can set up the cut queue itself
- [ ] **Nikon Z camera** (borrow or rent one): run the NikonBridge self-test, HARDWARE_SETUP.md section 1b
- [ ] **Camera**: shutter not on Bulb; unplug/replug reconnect test; confirm shots get renamed "20.14.05 1.jpg" in the event's Photos folder
- [ ] **Green screen** with your real backdrop and lighting; **AI backgrounds** speed and quality with real guests on the Surface
- [ ] **Boomerang MP4** encodes with Windows' own encoder (the GIF works regardless)
- [ ] **Video guestbook** with a real webcam and microphone; time to convert a 60-second message
- [ ] **360 booth** with a GoPro HERO9–12 when you have one (section 3 of HARDWARE_SETUP.md)
- [ ] **Foot pedal / clicker**: "Learn key" with your device
- [ ] **Phone remote**: allow the Windows firewall prompt on private networks; scan the QR
- [ ] **Installer**: `npm run dist:win` has never been run. Build it and confirm: kiosk lock, the `.booth` folder is hidden, sign-in returns to the app through the dslrsnap:// link, and the tamper protection (Electron fuses) doesn't stop the app starting
- [ ] A **4-hour soak test** with camera and printer connected

## 5. Still to build (me, when you say go)

- [x] **Auto-updates** that never install during an event (built; first real test needs two released versions). Releases: `npm run dist:win` then `npm run release`
- [x] **Download page** (public /download) reading the newest release from R2. R2 is set up and tested (keys in the root `.env`, public on `downloads.dslrsnap.com`); shows the button after the first `npm run release`
- [x] **ffmpeg and the AI model mirrored** to downloads.dslrsnap.com/deps (`npm run mirror-deps`); `fetch-models` uses the mirror first, upstream second, checksum-verified
- [x] **2-inch cut button**: opens Windows' Printing Preferences for the right printer and comes back to the app (built). Still open: set up a second "2x6 cut" printer entry automatically, after the printer-info output
- [ ] **Founding-member banner** on the pricing section (if you want the offer)
- [x] **Account deletion** on the Account page: cancels the subscription, deletes gallery files and the login (tested against Supabase and Stripe test mode)
- [x] **Nikon Z-series bridge** (built, compiles; 3 struct-packing bugs and the live-view offset fixed on 29 Oct; untested on a camera). Kept out of git in `native/NikonBridge/` until the repo is private; then delete the temporary line in `.gitignore` and commit it. Test steps in HARDWARE_SETUP.md section 1b
- [x] **Nikon D-series** built into the same NikonBridge (MAID3, one module per model, picked automatically). Compiles; struct layouts checked against Nikon's headers; untested on a camera. The website still says D-series "coming next" until a real test passes
- [ ] **More cameras and printers**: other Canon bodies need testing; Sony, Mitsubishi and Citizen are on the roadmap only
- [ ] **360 auto-start** when the arm moves (needs a sensor), and the green-screen key tuned on real footage
- [x] **Rate limiting** per IP on the app API, sign-in, password reset, contact form and app sign-in approval (migration 0008)
- [ ] Look into the one flaky test (the GIF test once hung during a full parallel run)

## 5b. Built on 28 October (emails, admin, chat)

- [x] Branded emails for sign-up, password reset, billing, computers, deletion, updates and support, plus team notices to support@
- [x] Admin at a private address: dashboard, customers, free access, password help, support inbox, update announcements, activity log
- [x] Support chat for customers (website and the app's Help & chat button); the contact form opens a conversation too
- [ ] **You**: add `SEND_EMAIL_HOOK_SECRET` and the five `ADMIN_*` values in Vercel; turn on the Supabase Send Email hook (ACCOUNTS_SETUP.md); paste the Gmail signatures (docs/email-signature.html)
- [x] Email replies into the chat (built and tested locally). **You**: Resend receiving domain `reply.dslrsnap.com`, webhook and a full-access key (ACCOUNTS_SETUP.md)

## 6. Already done and working without credentials

Everything else from the plan is built and tested with simulated hardware or locally:

- **Photo booth**: live view, DSLR, printing, GIFs, boomerangs, glam and filters, green screen and AI backgrounds, event folders
- **Other booth types**: video guestbook and 360 with the GoPro
- **Operator tools**: phone remote, foot pedal, kiosk lock, paper counter, readiness home screen
- **Accounts, payments and cloud**: account and licence code, Stripe wiring, cloud gallery and host gallery, ready for the credentials above
- **Website**: SEO, structured data, sitemap, analytics, support with a contact form, and legal drafts
