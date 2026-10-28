# To do before launch

Everything that's left, from a full review of the app and website (27 October 2026). Nothing below needs new code unless it's under "Still to build".

## 1. Accounts and credentials (you)

None of these exist yet; the app and website switch each feature on once its settings are added. Step-by-step: [ACCOUNTS_SETUP.md](ACCOUNTS_SETUP.md).

- [ ] **Domain**: point dslrsnap.com at Vercel; create the inboxes hello@ and support@dslrsnap.com
- [ ] **Licence keys**: `node website/scripts/generate-licence-keys.mjs`. Private key in Vercel; public key in the app's `.env` before building the installer. Keep the private key in a password manager
- [ ] **Supabase**: create the project, run migrations `0001`–`0004`, set redirect URLs, custom SMTP for sign-up emails, optional Google sign-in
- [ ] **Stripe** (test mode first): two "DSLR Snap" prices ($30/month, $168/year) and two "Extra booth computer" prices ($5/month, $50/year), customer portal, webhook; optional Stripe Tax; optional `FOUNDER` promotion code
- [ ] **Vercel environment variables**: every name in `website/.env.example`, including `CRON_SECRET`
- [ ] **Resend** (contact form email): verify the domain, add `RESEND_API_KEY`
- [ ] **Google Search Console**: add `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, then submit `https://dslrsnap.com/sitemap.xml`
- [ ] **Run the end-to-end test** in ACCOUNTS_SETUP.md section 5 (sign up, pay with the test card, sign the app in, QR gallery, host gallery, cancel)
- [ ] **Stripe live mode**: recreate the products, prices and webhook in live mode and swap the keys

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
- [x] **Download page** (public /download) reading the newest release from R2. Needs: R2 keys in the root `.env`, the bucket made public on `downloads.dslrsnap.com`, then a first `npm run release`
- [ ] **Copy the ffmpeg build** to a release in your GitHub repo, and point `scripts/fetch-models.mjs` at it (BtbN deletes old builds)
- [x] **2-inch cut button**: opens Windows' Printing Preferences for the right printer and comes back to the app (built). Still open: set up a second "2x6 cut" printer entry automatically, after the printer-info output
- [ ] **Founding-member banner** on the pricing section (if you want the offer)
- [x] **Account deletion** on the Account page: cancels the subscription, deletes gallery files and the login (tested against Supabase and Stripe test mode)
- [x] **Nikon Z-series bridge** (built, untested: no camera yet). Kept out of git in `native/NikonBridge/` until the repo is private; then delete the temporary line in `.gitignore` and commit it. Test steps in HARDWARE_SETUP.md section 1b
- [ ] **Nikon D-series bridge** (D750/D780/D850/D810/D610/D7500/D7200/D5600/D5300): Nikon's older MAID3 modules, a separate bridge. The website says "coming next"
- [ ] **More cameras and printers**: other Canon bodies need testing; Sony, Mitsubishi and Citizen are on the roadmap only
- [ ] **360 auto-start** when the arm moves (needs a sensor), and the green-screen key tuned on real footage
- [ ] **Rate limiting** on the website's API routes and contact form (today: one-time codes, PKCE and a honeypot)
- [ ] Look into the one flaky test (the GIF test once hung during a full parallel run)

## 6. Already done and working without credentials

Everything else from the plan is built and tested with simulated hardware or locally:

- **Photo booth**: live view, DSLR, printing, GIFs, boomerangs, glam and filters, green screen and AI backgrounds, event folders
- **Other booth types**: video guestbook and 360 with the GoPro
- **Operator tools**: phone remote, foot pedal, kiosk lock, paper counter, readiness home screen
- **Accounts, payments and cloud**: account and licence code, Stripe wiring, cloud gallery and host gallery, ready for the credentials above
- **Website**: SEO, structured data, sitemap, analytics, support with a contact form, and legal drafts
