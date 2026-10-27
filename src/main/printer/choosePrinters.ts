export interface InstalledPrinter {
  name: string
  driverName?: string
}

export interface PrinterChoice {
  /** Windows queue for 4x6 prints, or undefined when no suitable printer is installed. */
  queue4x6?: string
  queue2x6?: string
  /** True when the queue was detected rather than picked by the operator. */
  auto4x6: boolean
  auto2x6: boolean
  /** Strips go to a queue without the 2-inch cut, so they come out as one uncut 4x6. */
  stripsUncut: boolean
}

// DNP names its DS-RX1HS queue and driver "DS-RX1", "DP-DS-RX1HS" or "DNP DS-RX1HS" depending on version.
const DNP = /\bDNP\b|\bDP-DS|\bDS-?RX1/i
const CUT = /2\s*[x×]\s*6|\bcut\b/i

const isDnp = (p: InstalledPrinter) => DNP.test(p.name) || DNP.test(p.driverName ?? '')

/**
 * Picks the Windows printer queues for 4x6 and 2x6 prints. A queue the operator chose by hand
 * wins while it is still installed; otherwise the DNP printer is found by name or driver, so
 * nobody has to rename printers in Windows to match the app.
 */
export function choosePrinters(installed: InstalledPrinter[], saved: { printerName4x6: string; printerName2x6: string }): PrinterChoice {
  const exists = (name: string) => !!name && installed.some((p) => p.name === name)
  const dnp = installed.filter(isDnp).sort((a, b) => a.name.localeCompare(b.name))
  const plain = dnp.filter((p) => !CUT.test(p.name))
  const cut = dnp.filter((p) => CUT.test(p.name))

  const auto4x6 = !exists(saved.printerName4x6)
  const queue4x6 = auto4x6 ? (plain[0] ?? dnp[0])?.name : saved.printerName4x6

  const auto2x6 = !exists(saved.printerName2x6)
  const queue2x6 = auto2x6 ? (cut[0]?.name ?? queue4x6) : saved.printerName2x6
  const stripsUncut = !!queue2x6 && auto2x6 && !cut.length

  return { queue4x6, queue2x6, auto4x6, auto2x6, stripsUncut }
}
