# Roadmap

## Phase 1 — Hardware gate (now)
Run docs/HARDWARE_SETUP.md on the real kit. Fix whatever it uncovers in `native/CanonBridge` and `WindowsPrinter`.

## Phase 2 — Event-ready MVP
- ~~Operator PIN for the admin menu~~ Done (Devices → Operator PIN). Next: an easier forgotten-PIN reset than the sqlite command in the README
- ~~Template editor~~ Done as **template import** (Operator → Templates)
- ~~Camera exposure controls + test shots~~ Done (Operator → Camera); verify on the R100 per HARDWARE_SETUP.md
- Hosted gallery page: QR → `https://gallery.<domain>/s/<sessionId>` so the QR can show instantly even offline (session IDs are random UUIDs), page shows "uploading…" until ready
- ~~Event export~~ Done as copy-to-folder/USB (Stats & photos). Still to do: retention/deletion settings
- Code-signing certificate (Authenticode) so SmartScreen doesn't warn customers

## Phase 3 — Sell to other operators
- Accounts + licensing API (device activation, subscription via Stripe)
- Replace Supabase service key with per-device upload tokens
- Auto-updates (electron-updater)
- Hardware compatibility checker on first run
- More cameras (other Canon bodies via same bridge; Nikon/Sony via their SDKs) and printers (Mitsubishi, Citizen)

## Later
GIF/boomerang, green screen, AI backgrounds, SMS/email delivery, analytics dashboard.
