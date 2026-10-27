import type { PrintFormat, PrinterDetection, PrinterStatus } from '../../shared/types'

export interface PrintRequest {
  filePath: string
  format: PrintFormat
  copies: number
  jobName: string
}

/**
 * Anything that can turn a print-ready sheet into paper.
 * `print` resolves once the job has been handed to the OS spooler — not when paper comes out.
 */
export interface PrinterAdapter {
  readonly driver: PrinterStatus['driver']
  print(req: PrintRequest): Promise<void>
  getStatus(): Promise<Omit<PrinterStatus, 'queueLength'>>
  /** Installed printers and the queues this adapter will print to. */
  detect(): Promise<PrinterDetection>
}
