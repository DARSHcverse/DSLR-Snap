# CanonBridge

Small .NET 8 console program that wraps Canon EDSDK and talks to the booth app with one JSON object per line over stdin/stdout.

Canon's SDK DLLs are **not** included (licence). Put the 64-bit `EDSDK.dll` and `EdsImage.dll` in `EDSDK/`, then:

```powershell
dotnet publish -c Release -o publish
.\publish\CanonBridge.exe --selftest C:\BoothTest   # hardware proof-of-concept
```

The app looks for `native/CanonBridge/publish/CanonBridge.exe` in development and bundles `publish/` into the installer.

Commands: `connect`, `status`, `capture {dir}`, `liveview_start`, `liveview_frame`, `liveview_stop`, `disconnect`, `ping`.
Events: `{"event":"disconnected"}`.

Compiled successfully against Windows x64 on Linux (`-p:EnableWindowsTargeting=true`); it has **not** yet been run against a camera — verify signatures in `Edsdk.cs` against your SDK headers.
