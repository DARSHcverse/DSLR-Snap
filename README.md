# DSLR Snap – Photo Booth Software for Windows

Windows photo booth app for event operators — Surface Pro + Canon EOS R100 + DNP DS-RX1HS.
Capture and printing are 100% local; cloud is only used for optional QR galleries.

## Status

| Area | State |
|---|---|
| Booth flow (welcome → countdown → capture → photo shown with instant retake → print → QR), per-event timings | Working with mock hardware |
| Guest gallery on the welcome screen (photos + looping GIF per session, can be turned off per event) | Working |
| Templates: 2×6 strips and 4×6 portrait/landscape, text, logo, PNG overlay | Working, 5 built-in layouts |
| Template import (Canva/ChatGPT PNG or JPG → photo windows found automatically, drag to adjust) | Working |
| Camera exposure (ISO / aperture / shutter / white balance, flash presets, test shots, saved per event) | Working with mock camera; **Canon side written, not yet run on the R100** |
| 5-step event setup, duplicate event, operator PIN, per-event stats, export photos to a folder/USB | Working |
| Local SQLite: events, sessions, print queue, upload queue | Working, crash-safe |
| Print queue with no-duplicate retry | Working (tested) |
| Canon EOS R100 via EDSDK (`native/CanonBridge`) | **Written and compiles — not yet run on the camera** |
| DNP DS-RX1HS via Windows driver | **Written — not yet printed on the printer** |
| Cloud gallery + QR (Supabase Storage) | Working in tests, needs your Supabase project |
| Installer (NSIS), licensing, auto-update | Installer config done; licensing/updates are later phases |

**Before building more features, run the hardware gate in [docs/HARDWARE_SETUP.md](docs/HARDWARE_SETUP.md).**

## Quick start (Mac or Windows, no hardware needed)

```bash
npm install          # also rebuilds native modules for Electron
npm run fetch-models # AI model + Windows ffmpeg (~110 MB, checksum-verified); needed once
npm run dev          # opens the app with mock camera + mock printer
```

First run shows "No event selected" → **Open admin** → **+ New event** → follow the 5 steps (Event, Template, Camera, Print & share, Test & launch) → **Launch event**.
Operator menu: the **⚙** button on the "Tap to start" screen, **Ctrl+Shift+A** at any time, or tap the top-left corner 5 times. If an operator PIN is set (Devices → Operator PIN), a keypad asks for it first.

Forgot the PIN? Close the app and run `sqlite3 "<app data>/data/booth.db" "DELETE FROM settings WHERE key = 'operator_pin'"` (app data: `%APPDATA%\DSLR Snap` on Windows, `~/Library/Application Support/DSLR Snap` on Mac).
Mock prints land in `Documents/DSLR Snap/mock-prints`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Run the app with hot reload |
| `npm test` | Unit + integration tests (119) |
| `npm run typecheck` | TypeScript check for main and renderer |
| `npm run fetch-models` | Download the AI cut-out model and the LGPL Windows ffmpeg into `resources/` (also run by `dist:win`) |
| `npm run render-samples` | Render every layout into `samples-output/` to eyeball designs |
| `npm run dist:win` | Build the Windows installer (run on Windows or via CI) |

> After `npm run dev`/`postinstall`, `better-sqlite3` is compiled for Electron. To run tests in plain Node afterwards: `npm rebuild better-sqlite3`.

## How it fits together

```
src/
  main/                 Electron main process (Node)
    index.ts            window, IPC, device wiring, logging
    BoothService.ts     capture → compose → print → upload (no Electron imports, unit tested)
    camera/             CameraAdapter, MockCamera, CanonBridgeCamera (talks to the .NET bridge)
    printer/            PrinterAdapter, MockPrinter, WindowsPrinter (DNP driver via Chromium print)
    compose/            sharp-based layout renderer (300 dpi print sheets)
    db/                 SQLite schema + migrations
    queue/              PrintQueue (idempotent, operator retry), UploadQueue (backoff, offline-safe)
    cloud/              CloudGallery (Supabase Storage, signed links)
  preload/              typed window.booth API
  renderer/             React UI: guest booth + operator admin
  shared/               types, layout math, templates, booth state machine
native/CanonBridge/     C# .NET 8 wrapper around Canon EDSDK, JSON over stdin/stdout
tests/                  vitest (incl. a fake Canon bridge for protocol tests)
```

Key decisions:
- **Camera SDK runs out-of-process.** A Canon SDK crash restarts the bridge, not the booth.
- **The printer always gets a portrait 4×6 sheet.** 2×6 strips are printed two-up and cut by the DNP driver; landscape layouts are rotated by the app, so driver orientation settings can't ruin a print.
- **One Windows printer queue per format.** Chromium can't select DNP's cut mode, so you add the printer twice (4×6 and 2×6-cut). See hardware doc.
- **Prints never duplicate by accident.** Each press has a request key; failed jobs wait for the operator; jobs interrupted by a crash become "Check printer".

## Cloud gallery (optional)

Copy `.env.example` to `%APPDATA%/dslr-snap/.env` (or the project root while developing) and fill in your Supabase project. Create a **private** bucket named `booth-sessions`.
The service key is fine on your own booths; **before selling to other operators**, replace it with a small upload API that issues per-device tokens.

## Website

The marketing site lives in [`website/`](website/) (Next.js + Tailwind, deployed on Vercel). It has its own `package.json` and is not part of the app build or installer. See [website/README.md](website/README.md).

See [docs/ROADMAP.md](docs/ROADMAP.md) for what comes next.
