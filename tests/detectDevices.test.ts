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
    expect(resolveCameraDriver('auto', { platform: 'win32', bridgeInstalled: true })).toBe('canon-edsdk')
    expect(resolveCameraDriver('auto', { platform: 'win32', bridgeInstalled: false })).toBe('mock')
    expect(resolveCameraDriver('auto', { platform: 'darwin', bridgeInstalled: false })).toBe('mock')
    expect(resolveCameraDriver('mock', { platform: 'win32', bridgeInstalled: true })).toBe('mock')
  })

  it('uses the Windows printer driver on Windows, mock elsewhere', () => {
    expect(resolvePrinterDriver('auto', 'win32')).toBe('windows-driver')
    expect(resolvePrinterDriver('auto', 'darwin')).toBe('mock')
    expect(resolvePrinterDriver('mock', 'win32')).toBe('mock')
  })
})
