import { BrowserWindow } from 'electron'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import sharp from 'sharp'
import { DPI, SHEET } from '../../shared/layout'
import type { DeviceSettings, PrinterDetection } from '../../shared/types'
import { choosePrinters, type InstalledPrinter, type PrinterChoice } from './choosePrinters'
import type { PrinterAdapter, PrintRequest } from './PrinterAdapter'

const run = promisify(execFile)
const MICRONS_PER_INCH = 25400
const LIST_TTL_MS = 4000

type WinPrinter = InstalledPrinter & { status?: string; jobs?: number }

/**
 * Prints through the installed Windows driver (DNP's official driver), using Chromium's
 * silent print path. No direct printer protocol work — the driver owns colour, cut and media.
 * The DNP queue is detected by name/driver, so it works whatever Windows called the printer.
 */
export class WindowsPrinter implements PrinterAdapter {
  readonly driver = 'windows-driver' as const
  private cache?: { at: number; list: Promise<WinPrinter[]> }
  private media = new Map<string, Promise<{ width: number; height: number } | null>>()

  constructor(private getSettings: () => DeviceSettings) {}

  /** Forget the cached printer list, e.g. after the operator changed printer settings. */
  refresh(): void {
    this.cache = undefined
    this.media.clear()
  }

  /** Installed printers with driver and status, from one PowerShell call shared by status polling and printing. */
  private installed(): Promise<WinPrinter[]> {
    if (this.cache && Date.now() - this.cache.at < LIST_TTL_MS) return this.cache.list
    const list = this.queryPrinters().catch(() => this.chromiumPrinters())
    this.cache = { at: Date.now(), list }
    return list
  }

  private async queryPrinters(): Promise<WinPrinter[]> {
    if (process.platform !== 'win32') return []
    const script = 'Get-Printer | ForEach-Object { [pscustomobject]@{ name = $_.Name; driverName = $_.DriverName; status = "$($_.PrinterStatus)"; jobs = $_.JobCount } } | ConvertTo-Json -Compress'
    const { stdout } = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 8000, windowsHide: true })
    const parsed = stdout.trim() ? JSON.parse(stdout) : []
    return Array.isArray(parsed) ? parsed : [parsed] // a single printer comes back as an object
  }

  /** Fallback when PowerShell is unavailable: names only, no driver or status. */
  private async chromiumPrinters(): Promise<WinPrinter[]> {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return []
    return (await win.webContents.getPrintersAsync()).map((p) => ({ name: p.name }))
  }

  private async choice(): Promise<PrinterChoice & { list: WinPrinter[] }> {
    const list = await this.installed()
    return { ...choosePrinters(list, this.getSettings()), list }
  }

  /**
   * The paper size the queue's driver has selected, in microns. Printing on exactly that size keeps
   * the driver's own media (DNP: "PC", 156.1 × 105 mm) and with it the 2-inch cut; a custom size
   * makes the DNP driver drop the cut.
   */
  private mediaSize(name: string): Promise<{ width: number; height: number } | null> {
    const cached = this.media.get(name)
    if (cached) return cached
    const script = `Add-Type -AssemblyName System.Printing
$t = (New-Object System.Printing.LocalPrintServer).GetPrintQueue($env:DS_PRINTER).DefaultPrintTicket
(New-Object System.IO.StreamReader($t.GetXmlStream())).ReadToEnd()`
    const size = run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      timeout: 8000,
      windowsHide: true,
      env: { ...process.env, DS_PRINTER: name }
    })
      .then(({ stdout }) => {
        const value = (key: string) => Number(new RegExp(`MediaSize${key}">\\s*<psf:Value[^>]*>(\\d+)`).exec(stdout)?.[1])
        const width = value('Width')
        const height = value('Height')
        return width > 0 && height > 0 ? { width, height } : null
      })
      .catch(() => null)
    this.media.set(name, size)
    return size
  }

  async print(req: PrintRequest): Promise<void> {
    const c = await this.choice()
    const deviceName = req.format === '2x6' ? c.queue2x6 : c.queue4x6
    if (!deviceName) throw new Error('No DNP printer found. Connect the printer by USB and switch it on.')
    const sheet = { width: Math.round((SHEET.w / DPI) * MICRONS_PER_INCH), height: Math.round((SHEET.h / DPI) * MICRONS_PER_INCH) }
    const page = (await this.mediaSize(deviceName)) ?? sheet
    // Our sheet is portrait; DNP's paper is defined landscape (as it feeds off the roll), so turn the picture to fit.
    const landscapePaper = page.width > page.height
    const jpeg = landscapePaper ? await sharp(req.filePath).rotate(90).jpeg({ quality: 95 }).toBuffer() : await readFile(req.filePath)
    const wMm = page.width / 1000
    const hMm = page.height / 1000
    const html = `<!doctype html><html><head><style>
      @page { size: ${wMm}mm ${hMm}mm; margin: 0 }
      html, body { margin: 0; padding: 0; width: ${wMm}mm; height: ${hMm}mm; overflow: hidden }
      img { display: block; width: ${wMm}mm; height: ${hMm}mm; object-fit: cover }
    </style></head><body><img src="data:image/jpeg;base64,${jpeg.toString('base64')}"></body></html>`

    const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true, javascript: false } })
    try {
      await win.loadURL(`data:text/html;base64,${Buffer.from(html).toString('base64')}`)
      await new Promise<void>((resolve, reject) => {
        win.webContents.print(
          {
            silent: true,
            deviceName,
            copies: req.copies,
            printBackground: true,
            color: true,
            landscape: false,
            margins: { marginType: 'none' },
            pageSize: page
          },
          (ok, reason) => (ok ? resolve() : reject(new Error(`Print failed on "${deviceName}": ${reason}`)))
        )
      })
    } finally {
      win.destroy()
    }
  }

  async detect(): Promise<PrinterDetection> {
    const { list, queue4x6, queue2x6, stripsUncut } = await this.choice()
    return { installed: list.map((p) => p.name), queue4x6, queue2x6, stripsUncut }
  }

  async getStatus() {
    if (process.platform !== 'win32') {
      return { driver: this.driver, state: 'error' as const, message: 'Windows driver printing only works on Windows.' }
    }
    const { list, queue4x6: name, stripsUncut } = await this.choice()
    if (!name) return { driver: this.driver, state: 'disconnected' as const, message: 'No DNP printer found. Connect it by USB and switch it on.' }
    const info = list.find((p) => p.name === name)
    if (!info?.status) return { driver: this.driver, state: 'ready' as const, printerName: name }
    const ok = /normal|idle|printing|^0$/i.test(info.status)
    const notes = [
      info.jobs ? `${info.jobs} job(s) in Windows queue` : '',
      stripsUncut ? '2×6 strips print uncut (no "2x6 cut" printer set up)' : ''
    ].filter(Boolean)
    return {
      driver: this.driver,
      state: ok ? (info.jobs ? ('busy' as const) : ('ready' as const)) : ('error' as const),
      printerName: name,
      message: ok ? notes.join(' · ') || undefined : `Printer reports: ${info.status}`
    }
  }
}
