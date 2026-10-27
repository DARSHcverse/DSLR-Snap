# DSLR Snap: product plan (draft for approval)

Status: proposal. Nothing below is built yet unless it says so. Prices are placeholders.

## 1. Where we are against dslrBooth

dslrBooth (now sold as "LumaBooth for Windows") is the market leader. Price: **$17/month billed yearly (~$204/year) for 2 computers**; $49.99 monthly. Their Booth Copilot phone remote and basic Fotoshare cloud gallery are included; the LumaShare sharing station ($7.99/month) and HashPrinter ($25/month) cost extra.

| Area | dslrBooth | DSLR Snap today |
|---|---|---|
| Stills, countdown, retakes, live view | Yes | Yes |
| GIF / boomerang | Yes | GIF yes, boomerang no |
| Video, 360, mirror booth, video guestbook | Yes | No |
| Glam (beauty + B&W) | Yes, a beauty filter plus B&W filters | **No** |
| Filters, LUT import | Yes | No |
| Green screen / AI background removal | Yes | No |
| Template editor | Built-in editor (reviewers find it clumsy) | Canva import with photo windows found automatically |
| Print queue with retry and no duplicates | Basic (reviewers ask for reprints) | **Stronger**: tracked jobs, retry, reprint |
| Offline sharing / QR | Yes | Yes (instant QR) |
| Email / SMS / survey / disclaimer | Yes | No |
| Pay-per-print (card, Apple Pay) | Yes | No |
| Remote monitoring | Paid add-on | No |
| Camera unplug recovery | Reviewers report crashes | **Auto-reconnect** |
| Auto-detect printer | Manual setup | **Yes (done today)** |

**Ideas to take from dslrBooth:**
- Glam mode
- Filters and LUTs
- Boomerang
- An attract loop on the start screen
- Survey and disclaimer screens
- Email sharing
- Later: AI background removal, video guestbook

**What to skip:**
- 360 booth, mirror booth, robot video, an iPad app. Each one is a separate product with its own hardware.
- Stickers.

## 2. Glam mode (your example)

Glam is an event setting, chosen as the event's "Look":
- **Colour** (current behaviour)
- **Glam B&W** (Hollywood style)
- **Other filters:** Warm, Vintage, Bright, Film, or a custom LUT

**Glam B&W defaults**
- **Screen and print:** guests see B&W on screen. The live view goes B&W too, so people pose for the look. The print is B&W.
- **Glam processing:**
  - Skin smoothing, adjustable from Off to Strong.
  - Soft contrast, with lifted highlights and a slight glow.
  - The approach follows Photo Booth Supply Co.'s guidance. They say high-contrast "noir" looks bad for glam and soft mono works.
- **Colour originals:** these are always saved, untouched.

**Options per event**
- **"Also give guests the colour version"**
  - The QR download page shows both versions, B&W and colour, side by side, each with its own download button.
  - On the booth screen, guests can tap to compare.
  - The print stays B&W unless the operator picks "Guest chooses".
- **Strength sliders**
  - Skin smoothing and glow.
  - Previewed live on a test shot in the Camera screen.
- **No eye enlarging or face reshaping.** Some apps do it, but it looks uncanny on DSLR-quality files.

**Build:**
- The filter runs in the existing sharp/libvips compose step. Live view uses a cheap CSS greyscale so it stays fast.
- Skin smoothing v1 is an edge-preserving blur blended into the midtones. That's good, and needs no AI.
- v2 adds face detection so only skin is smoothed, not hair or the background.

## 3. Redesign of the operator area

**Problem:** the top tab row (Events · Templates · Camera · Devices · Prints · Sessions) treats everything as equal, and it doesn't say what to do next. A new customer doesn't know the order. During an event, the things they need (status, paper, reprints) are spread across tabs.

**Proposal:** a left sidebar grouped by *when you need it*, plus a home screen.

```
┌──────────────┬──────────────────────────────────────────────┐
│ DSLR Snap    │  Ready to go ✓        [ Start booth ▶ ]      │
│              │  ● Camera  Canon R100 · M · ISO 400          │
│ ▸ Home       │  ● Printer DS-RX1 · ~412 prints left on roll │
│              │  ● Uploads 0 waiting · Online                │
│ EVENT        │  ● Disk    81 GB free                        │
│   Events     │                                              │
│   Look       │  Tonight: Priya & Tom · Glam B&W · 2×6       │
│   Sharing    │  [ Edit event ]  [ Test shot ]  [ Test print ]│
│              │                                              │
│ DURING       │  Last hour: 38 sessions · 76 prints · 2 fails│
│   Prints  2  │                                              │
│   Gallery    │                                              │
│              │                                              │
│ SETUP        │                                              │
│   Camera     │                                              │
│   Printer    │                                              │
│   Templates  │                                              │
│              │                                              │
│ Account      │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

**Home: the booth readiness check**
- One screen answers "can I open the doors?"
- Green or red for each of: camera, exposure, printer, paper, uploads, disk and licence.
- Each red item has its fix right there.

**Event setup**
- Setting up an event becomes a guided flow: **Details → Look → Template → Capture → Sharing → Print**.
- A live preview of the final print stays on the right the whole time.
- Presets set sensible defaults to start from: Wedding, Party, Corporate, Glam.

**During the event**
- **Prints** and **Gallery** show badges: failed prints in red, the count waiting.
- Reprint is one tap from any photo.

**Setup**
- Camera: exposure and test shots.
- Printer: auto-detected, test prints, paper counter.
- Templates.
- Things you touch once a month live here, out of the way.

**Visual and touch**
- Larger touch targets: the Surface is used by finger.
- The same theme, with a calmer layout.
- Icons alongside labels.
- Plain-language settings with one-line explanations, instead of 60 checkboxes.

## 4. New ideas: reasons to choose us over dslrBooth

1. **Paper counter.**
   - Track prints against the roll: the DS-RX1 gives about 700 4×6 or 1,400 2×6 per roll.
   - Warn at 50 left, so no one runs out mid-queue.
2. **Free phone remote, on the same Wi-Fi or hotspot.**
   - Scan a QR on the operator screen to open status, reprints, pause booth and the paper count.
   - dslrBooth includes theirs too, so this one is about keeping up rather than getting ahead.
3. **Host recap page.**
   - After the event, the client gets a branded gallery link with every photo, plus stats.
   - Operators can sell it as an upgrade.
   - It builds on the Cloud Gallery work.
4. **Updates never interrupt an event.** Updates download quietly and install only when no event is running.
5. **Event presets and duplicate.** "Same as last Saturday's wedding" in one tap. Duplicate already exists, and presets extend it.
6. **Guest consent and email capture, GDPR-friendly.**
   - An optional "email me my photos" screen, with an explicit consent tick.
   - Contacts can be exported for the client.
7. **Kiosk lockdown.** Hides the Windows taskbar and blocks swipe and Alt+Tab while the booth runs. The exit is behind the operator PIN.
8. **Attract screen.**
   - The live view is already there.
   - Add rotating sample prints from tonight, which nudge people walking past.
9. **Second-screen slideshow.** Plug a TV in over HDMI for a live slideshow of tonight's photos.
10. **Later, AI:**
    - Background removal without a green screen.
    - Auto-straighten and auto-crop to faces.
    - Best-of-burst, which picks the frame where nobody blinked.

## 5. Accounts, payments and app sign-in

**What the customer sees**
1. On dslrsnap.com: **Sign up** (email + password, or Google) → **choose a plan** → Stripe checkout → account dashboard.
2. They download the app, open it and press **Sign in**. Their default browser opens dslrsnap.com, where they are already signed in, and they press **"Open DSLR Snap"**.
3. The app comes back to the front, signed in. Done. No licence keys to copy.

The account dashboard on the website shows:
- Plan and renewal date
- Invoices, through Stripe's customer portal
- Their computers, each with a **Remove** button

**How it works**
- **Website accounts:**
  - Supabase Auth and Postgres. That's the same Supabase the Cloud Gallery needs, so it's one backend, not two.
  - It is hosted on Vercel next to the site.
- **Payments:**
  - Stripe Checkout and the Stripe Customer Portal handle cards, Apple Pay, upgrades, cancels and invoices. That means no card handling on our side.
  - Stripe webhooks (`checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.payment_failed`) update a `subscriptions` table.
  - The database follows Stripe. We never trust anything the browser says about payment.
  - Stripe Tax can handle UK VAT and US sales tax.
- **App sign-in:**
  - It follows the standard for desktop apps (OAuth 2.0 with PKCE, RFC 8252).
  - The app opens the browser with a one-time challenge. After sign-in, the site sends the browser to `dslrsnap://signed-in?code=…`. Windows hands that link to the app, and the app trades the code for its own token.
  - A stolen link is useless without the secret only that app instance holds.
  - **Fallback:** if a PC blocks the link, the page shows a 6-character code to type into the app.
- **Licence:**
  - The server issues a **signed licence**. It contains the account, this computer's ID and "valid until". The validity is whichever comes first: the end of the subscription, or 14 days from now.
  - The app checks the signature with a public key built into it. So it **works offline at venues for 14 days**, then needs to go online once.
  - The app also notices if the PC clock is wound back.
- **Two computers per plan.**
  - Each PC registers its Windows machine ID.
  - A third PC is refused, with "remove one on dslrsnap.com", which takes one click on the dashboard.
- **Without a subscription:**
  - The app still runs in **trial mode**: everything works, but prints and downloads carry a "DSLR Snap trial" watermark.
  - This is the best salesperson we have, and it is how dslrBooth's trial works too.

**Against people using it without paying**
- **Server-side gates cannot be bypassed.** Cloud gallery uploads, QR pages and recap pages are refused by our server without an active subscription. These are the features customers value most.
- **Signed licences:**
  - Editing settings or copying the app folder to another PC doesn't work. The licence is tied to that machine's ID, and the signature breaks if it is changed.
- **A tamper-resistant app:**
  - Electron's integrity checks (fuses: ASAR integrity, only load the app from the archive) stop people editing the code inside the installed app.
  - Code signing with Azure Trusted Signing, about $10/month, also stops the Windows "unknown publisher" warning.
- **Honest limit:** no desktop app is uncrackable. A determined cracker can patch the binary. The aim is that sharing an account or copying the app doesn't work, and that pirates lose the cloud features. That is what protects revenue in practice.

**What I need from you**
- A Stripe account: test mode is fine to start, so no real money moves.
- A Supabase project.
- The dslrsnap.com domain pointed at Vercel.
- (Prices decided: $30/month, or $14/month billed yearly ($168); extra computers $50/year; phone remote and cloud gallery included; watermarked trial with no time limit.)

## 6. Website

**Done today**
- A **Pricing** section: Monthly **$30**, and Yearly **$14/month billed $168** (marked "Best value", saves 53%). Extra computers $50/year.
- A "Pricing" link in the top menu.
- A FAQ entry promising the 14-day offline grace. If you change that number in the plan, the FAQ needs to change too.

**Next, with accounts**
- Pages: `/signup`, `/login`, `/account` (plan, computers, invoices) and `/app/sign-in` (the page the app opens).
- The Stripe checkout buttons replace "Get early access".
- A download page, shown only to signed-in users.
- Legal pages: Terms, Privacy, Refunds. Stripe requires these before taking live payments. I can draft them, but have them checked.

## 7. Suggested order

| Phase | What | Why this order |
|---|---|---|
| A | Accounts, Stripe, app sign-in, licence + trial watermark | You can't sell without it, and it is the riskiest piece |
| B | Glam mode + filters (B&W, colour choice, skin smoothing, LUT) | Your top feature request, and an easy sell |
| C | New operator layout: sidebar, Home readiness check, event flow | Makes everything after it easier to find |
| D | Cloud gallery steps 2–5 + host recap page | Needs the Phase A backend, and is the strongest server-side gate |
| E | Paper counter, phone remote, kiosk lockdown, boomerang, email capture | Quick wins, in any order |
| Later | AI background removal, video guestbook, pay-per-print | Big, and worth doing once paying customers ask for them |

## 8. What I highly recommend

These are the decisions I'd look at most closely:

- **Build Phase A (accounts and licensing) first.**
  - Every other feature is worth less if it can be used free.
  - A trial watermark is a better funnel than a time-limited trial: people use it at a real event and their guests see the watermark.
- **Use Supabase for both accounts and the cloud gallery.** One backend, one bill, one login.
- **Keep valuable features server-side** (QR gallery, recap pages). That is the anti-piracy measure that actually works.
- **Allow 14 days of offline use.** Venues have bad Wi-Fi. Locking out a paying customer mid-wedding would cost us far more than the occasional cheater.
- **Ship Glam with "B&W only" as the default and "also give the colour version" as one switch.** This is exactly your spec, and it matches what glam-booth guests expect.
- **Make the Home readiness screen the centrepiece of the redesign.** It is the thing operators feel every single event, and dslrBooth doesn't have it.
- **Include the free phone remote and paper counter.** They are cheap to build, they beat a paid dslrBooth add-on, and they are easy to put in marketing.
- **Price (decided):** $168/year and $30/month, extra computers $50/year (dslrBooth: $204, $49.99 and $204). The optional founding offer is $120/year for the first 100 customers.

---
Sources:
- [dslrBooth software features](https://dslrbooth.com/dslrBooth-Photo-Booth-Software)
- [dslrBooth pricing](https://dslrbooth.com/pricing)
- [dslrBooth 7 subscriptions](https://blog.dslrbooth.com/dslrbooth-7-subscriptions/)
- [LumaBooth glam booth](https://www.lumabooth.com/glambooth)
- [dslrBooth v6.34 beauty/glam filter](https://blog.dslrbooth.com/?p=2685)
- [Photo Booth Supply Co. glam booth guide](https://support.photoboothsupplyco.com/salsa/how-to-create-the-kardashian-style-glam-photo-booth)
- [dslrBooth user reviews](https://dslrbooth.com/dslrbooth-reviews?stars=3)

## 9. Phase F: capture modes (green screen, AI backgrounds, video, 360)

These are expected of a serious booth app, so they move from "later" into the plan. They share two foundations, so the order matters.

| Step | What | Hardware | Notes |
|---|---|---|---|
| F1 | **Green screen** (stills) | Green or blue backdrop, even lighting | Chroma key in the existing compose step. A background library per event, and guests pick a background on screen before shooting. Live view shows the key in real time. Edges softened, green spill removed. |
| F2 | **AI backgrounds** (no backdrop) | None | On-device cut-out with BiRefNet (MIT licence, so no per-photo cost and it works offline). Expect about 2–4 s per photo on a Surface. Reuses F1's background picker. Generated "AI scenes" (e.g. "Paris at night") need a cloud model with a per-image cost, so they're a later paid add-on. |
| F0 | **Video foundation** | — | Bundle ffmpeg to record, encode, overlay and add music. MP4 support in the booth gallery, the cloud gallery and the guest page. Needed by F3 and F4. |
| F3 | **Video booth / video guestbook** | Webcam or GoPro | A short clip with a countdown and a prompt ("Leave a message for the couple"). The Canon R100 can't stream video to a PC through Canon's SDK, so video uses a webcam or a GoPro. |
| F4 | **360 booth** | 360 spinner + GoPro HERO9–12 | Automatic connection: the booth finds a GoPro plugged in by USB (Open GoPro). It records at 120/240 fps while the arm spins, downloads the clip, then automatically adds a speed ramp (normal, slow-mo, normal), an overlay frame, music and an intro/outro. The QR is delivered the same way as photos. Start from the app, the phone remote or a foot pedal. |

Testing needs the real hardware for F3 and F4: a GoPro on the laptop, and ideally a spinner.

Sources:
- [Open GoPro](https://gopro.com/en/mt/info/open-gopro)
- [BiRefNet (MIT)](https://replicate.com/sprited/birefnet/readme)
- [dslrBooth 360](https://dslrbooth.com/360)
- [dslrBooth GoPro 360 support](https://blog.dslrbooth.com/dslrbooth-for-windows-v6-41-gopro-360-support/)
