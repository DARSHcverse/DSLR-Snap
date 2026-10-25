import { BrowserWindow } from 'electron'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { DPI, SHEET } from '../../shared/layout'
import type { DeviceSettings } from '../../shared/types'
import type { PrinterAdapter, PrintRequest } from './PrinterAdapter'

const run = promisify(execFile)
const MICRONS_PER_INCH = 25400

/**
 * Prints through the installed Windows driver (DNP's official driver), using Chromium's
 * silent print path. No direct printer protocol work — the driver owns colour, cut and media.
 *
 * NOT YET PROVEN ON HARDWARE: verify scaling (must be 100%, no white border) and both
 * queues with a real DS-RX1HS before relying on this at an event.
 */
export class WindowsPrinter implements PrinterAdapter {
  readonly driver = 'windows-driver' as const

  constructor(private getSettings: () => DeviceSettings) {}

  private queueFor(format: PrintRequest['format']): string {
    const s = this.getSettings()
    return format === '2x6' ? s.printerName2x6 : s.printerName4x6
  }

  async print(req: PrintRequest): Promise<void> {
    const deviceName = this.queueFor(req.format)
    const jpeg = await readFile(req.filePath)
    const wMm = (SHEET.w / DPI) * 25.4
    const hMm = (SHEET.h / DPI) * 25.4
    const html = `<!doctype html><html><head><style>
      @page { size: ${wMm}mm ${hMm}mm; margin: 0 }
      html, body { margin: 0; padding: 0; width: ${wMm}mm; height: ${hMm}mm; overflow: hidden }
      img { display: block; width: ${wMm}mm; height: ${hMm}mm }
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
            pageSize: { width: Math.round((SHEET.w / DPI) * MICRONS_PER_INCH), height: Math.round((SHEET.h / DPI) * MICRONS_PER_INCH) }
          },
          (ok, reason) => (ok ? resolve() : reject(new Error(`Print failed on "${deviceName}": ${reason}`)))
        )
      })
    } finally {
      win.destroy()
    }
  }

  async listPrinters(): Promise<string[]> {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return []
    return (await win.webContents.getPrintersAsync()).map((p) => p.name)
  }

  async getStatus() {
    const name = this.getSettings().printerName4x6
    if (process.platform !== 'win32') {
      return { driver: this.driver, state: 'error' as const, printerName: name, message: 'Windows driver printing only works on Windows.' }
    }
    try {
      // Name is passed as an argument, never interpolated into the script, to avoid injection.
      const script = `param($n) $p = Get-Printer -Name $n -ErrorAction Stop; [pscustomobject]@{ status = "$($p.PrinterStatus)"; jobs = $p.JobCount } | ConvertTo-Json -Compress`
      const { stdout } = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `& {${script}} '${name.replace(/'/g, "''")}'`], { timeout: 8000, windowsHide: true })
      const info = JSON.parse(stdout.trim()) as { status: string; jobs: number }
      const ok = /normal|idle|printing|0/i.test(info.status)
      return {
        driver: this.driver,
        state: ok ? (info.jobs > 0 ? ('busy' as const) : ('ready' as const)) : ('error' as const),
        printerName: name,
        message: ok ? (info.jobs ? `${info.jobs} job(s) in Windows queue` : undefined) : `Printer reports: ${info.status}`
      }
    } catch (e) {
      return { driver: this.driver, state: 'disconnected' as const, printerName: name, message: `Printer "${name}" not found or offline` }
    }
  }
}
