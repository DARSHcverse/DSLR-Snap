# Read-only: records the installed printers and what the DNP driver offers (paper sizes, cut options),
# so DSLR Snap can learn to set up 2x6 cutting by itself. Changes nothing.
# Run:  powershell -ExecutionPolicy Bypass -File scripts\printer-info.ps1
# Writes dnp-printer-info.txt to the Desktop.

$out = Join-Path ([Environment]::GetFolderPath('Desktop')) 'dnp-printer-info.txt'
Add-Type -AssemblyName System.Printing, ReachFramework

& {
  "Generated $(Get-Date -Format s) on $([Environment]::OSVersion.VersionString)"
  ''
  '=== All printers ==='
  Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus | Format-Table -AutoSize | Out-String -Width 250

  $dnp = Get-Printer | Where-Object { "$($_.Name) $($_.DriverName)" -match 'DNP|DP-DS|DS-?RX1' }
  if (-not $dnp) { 'No DNP printer found. Connect it by USB, switch it on, and run this again.' }

  foreach ($p in $dnp) {
    "=== $($p.Name) ==="
    Get-PrinterDriver -Name $p.DriverName | Format-List Name, Manufacturer, MajorVersion, DriverVersion, InfPath | Out-String
    $cfg = Get-PrintConfiguration -PrinterName $p.Name
    "Default paper size: $($cfg.PaperSize)"
    ''
    '--- Current defaults (PrintTicket) ---'
    $cfg.PrintTicketXML
    ''
    '--- Everything the driver supports (PrintCapabilities) ---'
    try {
      $queue = (New-Object System.Printing.LocalPrintServer).GetPrintQueue($p.Name)
      (New-Object System.IO.StreamReader($queue.GetPrintCapabilitiesAsXml())).ReadToEnd()
    } catch { "Could not read capabilities: $_" }
    ''
  }
} *>&1 | Out-File -FilePath $out -Encoding utf8

"Saved: $out"
