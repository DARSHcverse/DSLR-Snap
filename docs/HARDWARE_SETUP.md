# Hardware setup and proof-of-concept gate

Do these on the actual Surface Pro, with the actual camera and printer, before investing in more features.
Tick every box; anything that fails changes the plan.

## 0. Surface Pro

- [ ] Windows 11 up to date, Surface firmware updated
- [ ] Power plan: never sleep when plugged in; screen off = never during events
- [ ] Settings → Bluetooth & devices → USB → turn off "USB battery saver" / allow USB selective suspend off
  (Control Panel → Power Options → Advanced → USB selective suspend = Disabled)
- [ ] Ports: Surface Pro 8+ has 2× USB-C. Use a **powered** USB-C hub/dock for camera + printer + charging
- [ ] Run a 4-hour soak test with both devices connected (heat, disconnects)

## 1. Camera — Canon EOS R100 over USB

1. Join the Canon developer programme and download the latest **EDSDK** for Windows. Confirm the EOS R100 is on its supported-models list and read the licence terms (redistribution of the DLLs with a sold product).
2. Copy the 64-bit DLLs (`EDSDK_64/Dll/EDSDK.dll`, `EdsImage.dll`) into `native/CanonBridge/EDSDK/`.
3. Install the .NET 8 SDK, then:
   ```powershell
   cd native\CanonBridge
   dotnet publish -c Release -o publish
   .\publish\CanonBridge.exe --selftest C:\BoothTest
   ```
4. Camera settings: **JPEG only** (no RAW), Auto power off = disable, camera on mains dummy battery (ACK-E10 style coupler) — batteries die mid-event.
5. Close Canon EOS Utility (it grabs the camera and blocks the SDK).

Gate checks:
- [ ] Selftest prints `PASS` and three shot timings (target: < 2.5 s shutter-to-file)
- [ ] Live view reported as supported, first frame arrives (if not: the booth shows "Look at the camera ↑" — workable, but decide)
- [ ] Unplug the USB cable mid-session → app shows camera disconnected → replug → reconnects by itself within ~5 s
- [ ] Leave camera idle 45 minutes → still captures (keep-alive works)
- [ ] If shots fail with `--shutter=press`, try `--shutter=take` and note which works
- [ ] Selftest prints an `Exposure (raw EDSDK codes…)` line with `"mode":3` when the dial is on **M**, and non-empty `allowed` lists for iso/av/tv/wb

Exposure controls (app → Operator → **Camera**, camera dial on **M**, flash attached and on):
- [ ] Values shown match the camera's screen (ISO, f-number, shutter, white balance)
- [ ] ◀ ▶ on each setting changes the camera within a second; turning a dial on the camera updates the app
- [ ] Zoom the lens: the aperture list changes (kit lens: widest f/4.5 at 18 mm → f/6.3 at 45 mm)
- [ ] Turn the dial to Auto: the app asks for **M** and the controls lock; back to M: they unlock
- [ ] Test shot at **1/200**: no dark band at the top/bottom of the frame. If there is one, the R100's flash sync is slower than assumed — lower `FLASH_SYNC_SECONDS` in `src/shared/exposure.ts`
- [ ] "Too dark / too bright / looks good" agrees with what you see on the test shot; set exposure for the venue, unplug and replug the camera → settings come back

If the selftest crashes or errors on struct/stack issues: compare `Edsdk.cs` signatures with `EDSDK.h` / `EDSDKTypes.h` from your SDK version (EDSDK 13.x uses 64-bit sizes).

## 2. Printer — DNP DS-RX1HS over USB

1. Install DNP's official Windows driver for the DS-RX1HS.
2. Plug it in. The app finds the DNP printer by itself (Admin → Devices shows "Automatic — <name>"), whatever Windows named it. No renaming needed.
3. For **2×6 strips cut automatically**, Windows needs a second entry for the same printer with the cut turned on (until the app sets this up itself):
   - Add the printer again (same port), give it a name containing `2x6` or `cut` (e.g. `DS-RX1 (2x6 cut)`) → Printing preferences: paper **(6x4)** with **2-inch cut** enabled
   - Without it, strips still print, as one uncut 4×6, and Devices says so.
4. Press **Test print 4×6** and **Test print 2×6**.

Gate checks:
- [ ] Red border is just trimmed or barely visible on all four edges; blue dashed box fully visible (= correct scale, no white border)
- [ ] 2×6 test cuts exactly on the green line
- [ ] A real session prints a strip pair and a 4×6 correctly
- [ ] Open the printer door / remove paper → job shows **Failed**, nothing reprints until you press Retry
- [ ] Print 20 sessions back-to-back — no duplicates, none lost

If the image is scaled or has white edges: the page size in `src/shared/layout.ts` (`SHEET`) or the driver's paper choice needs adjusting. Note the driver's reported printable size and update `SHEET`.

## 3. 360 booth: GoPro HERO9–12 over USB

The 360 booth was built against GoPro's Open GoPro API and tested with a simulated camera. These checks confirm a real one behaves the same (about 5 minutes):

1. Update the GoPro firmware (GoPro Quik app), insert a memory card with space, and charge it.
2. Open DSLR Snap → Operator → Printer & devices → **360 camera (GoPro)**. Plug the GoPro into the laptop by USB and switch it on.

Gate checks:
- [ ] Within ~5 s the card says **GoPro connected by USB** (no app, no pairing). If not: the GoPro may need *Preferences → Connections → USB Connection → GoPro Connect* (not MTP), then replug
- [ ] Create an event with Booth type **360 booth**, spin 5 s, 120 fps → Home shows **GoPro: Connected by USB**
- [ ] Start a session: the GoPro starts recording on "Spin!", stops after 5 s, and the app shows "Making your 360 video…"
- [ ] The video plays on screen: normal speed → slow motion → normal, portrait, with your overlay and music
- [ ] `Videos\<time>.mp4` (the edit) and `Videos\Raw\<time>.mp4` (the GoPro original) are in the event folder
- [ ] Try 240 fps: the camera switches to 1080p 240 (if your model refuses that combination, the app logs it and records with the camera's current setting)
- [ ] Unplug the USB mid-idle → the card shows disconnected; replug → connected again by itself
- [ ] Leave it connected 30 minutes → still connected (the app keeps it awake)

If the GoPro is found but "not answering", note the message in the log (Printer & devices → App → Log) and send it over.

## 4. Full event rehearsal

- [ ] App installed via the NSIS installer (not dev mode), runs fullscreen
- [ ] Wi-Fi off: 30 sessions capture and print; QR screen says upload later
- [ ] Wi-Fi on: pending uploads go up; QR appears for new sessions
- [ ] Power-pull the Surface mid-print → restart → job shows **Check printer**
