import { copyFile, mkdir } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { PrinterAdapter, PrintRequest } from './PrinterAdapter'

/** Development printer: "prints" by copying the sheet into a folder so you can inspect it. */
export class MockPrinter implements PrinterAdapter {
  readonly driver = 'mock' as const
  failNext = false

  constructor(private outDir: string, private delayMs = 1500) {}

  async print(req: PrintRequest): Promise<void> {
    await new Promise((r) => setTimeout(r, this.delayMs))
    if (this.failNext) {
      this.failNext = false
      throw new Error('Mock printer: simulated paper jam')
    }
    await mkdir(this.outDir, { recursive: true })
    for (let i = 0; i < req.copies; i++) {
      await copyFile(req.filePath, join(this.outDir, `${req.jobName}-copy${i + 1}-${basename(req.filePath)}`))
    }
  }

  async getStatus() {
    return { driver: this.driver, state: 'ready' as const, printerName: `Folder: ${this.outDir}` }
  }

  async listPrinters() {
    return ['Mock printer (saves to folder)']
  }
}
