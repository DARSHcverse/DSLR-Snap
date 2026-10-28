import { describe, expect, it } from 'vitest'
import { resolveCameraDriver, resolvePrinterDriver } from '../src/main/detectDevices'
import { choosePrinters, type InstalledPrinter } from '../src/main/printer/choosePrinters'

const pdf: InstalledPrinter = { name: 'Microsoft Print to PDF', driverName: 'Microsoft Print To PDF' }
const office: InstalledPrinter = { name: 'HP LaserJet Pro', driverName: 'HP Universal Printing PCL 6' }
// What Windows created on the test laptop when the DS-RX1HS was plugged in.
const dnp: InstalledPrinter = { name: 'DS-RX1', driverName: 'DS-RX1' }
const dnpCut: InstalledPrinter = { name: 'DS-RX1 (2x6 cut)', driverName: 'DS-RX1' }
const none = { printerName4x6: '', printerName2x6: '' }

describe('choosePrinters', () => {
  it('finds the DNP printer under whatever name Windows gave it', () => {
    const c = choosePrinters([pdf, dnp, office], none)
    expect(c.queue4x6).toBe('DS-RX1')
    expect(c.auto4x6).toBe(true)
  })

  it('ignores a saved name that no longer exists instead of failing to print', () => {
    // Regression: the old default "DP-DS-RX1HS" made printing fail with "Invalid deviceName".
    const c = choosePrinters([pdf, dnp], { printerName4x6: 'DP-DS-RX1HS', printerName2x6: 'DP-DS-RX1HS (2x6 cut)' })
    expect(c.queue4x6).toBe('DS-RX1')
  })

  it('recognises DNP by driver name when the printer was renamed', () => {
    const c = choosePrinters([pdf, { name: 'Booth printer', driverName: 'DNP DS-RX1HS' }], none)
    expect(c.queue4x6).toBe('Booth printer')
  })

  it('uses the cut queue for strips and the plain queue for 4x6', () => {
    const c = choosePrinters([dnpCut, dnp], none)
    expect(c.queue4x6).toBe('DS-RX1')
    expect(c.queue2x6).toBe('DS-RX1 (2x6 cut)')
    expect(c.stripsUncut).toBe(false)
  })

  it('prints strips on the 4x6 queue, flagged as uncut, when there is no cut queue', () => {
    const c = choosePrinters([dnp], none)
    expect(c.queue2x6).toBe('DS-RX1')
    expect(c.stripsUncut).toBe(true)
  })

  it('keeps a printer the operator picked by hand, even a non-DNP one', () => {
    const c = choosePrinters([dnp, office], { printerName4x6: 'HP LaserJet Pro', printerName2x6: '' })
    expect(c.queue4x6).toBe('HP LaserJet Pro')
    expect(c.auto4x6).toBe(false)
  })

  it('finds nothing when no DNP printer is connected', () => {
    const c = choosePrinters([pdf, office], none)
    expect(c.queue4x6).toBeUndefined()
    expect(c.queue2x6).toBeUndefined()
  })
})

describe('automatic device drivers', () => {
  it('uses the Canon camera on Windows when the bridge is installed, mock otherwise', () => {
    const win = (canonInstalled: boolean, nikonInstalled: boolean) => ({ platform: 'win32' as const, canonInstalled, nikonInstalled })
    expect(resolveCameraDriver('auto', win(true, true))).toBe('any') // Canon or Nikon, whichever is plugged in
    expect(resolveCameraDriver('auto', win(true, false))).toBe('canon-edsdk')
    expect(resolveCameraDriver('auto', win(false, true))).toBe('nikon')
    expect(resolveCameraDriver('auto', win(false, false))).toBe('mock')
    expect(resolveCameraDriver('auto', { platform: 'darwin', canonInstalled: false, nikonInstalled: false })).toBe('mock')
    expect(resolveCameraDriver('mock', win(true, true))).toBe('mock')
    expect(resolveCameraDriver('nikon', win(true, true))).toBe('nikon')
  })

  it('uses the Windows printer driver on Windows, mock elsewhere', () => {
    expect(resolvePrinterDriver('auto', 'win32')).toBe('windows-driver')
    expect(resolvePrinterDriver('auto', 'darwin')).toBe('mock')
    expect(resolvePrinterDriver('mock', 'win32')).toBe('mock')
  })
})
