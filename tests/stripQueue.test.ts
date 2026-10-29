import { describe, expect, it } from 'vitest'
import { findCutOption, stripQueueName, withOption } from '../src/main/printer/stripQueue'

// Shaped like a v3 driver's PrintCapabilities, with the driver's own namespace for private features.
const CAPS = `<?xml version="1.0" encoding="UTF-8"?>
<psf:PrintCapabilities xmlns:psf="http://schemas.microsoft.com/windows/2003/08/printing/printschemaframework" xmlns:psk="http://schemas.microsoft.com/windows/2003/08/printing/printschemakeywords" xmlns:ns0000="http://schemas.dnp.co.jp/ds-rx1" version="1">
  <psf:Feature name="psk:PageMediaSize">
    <psf:Option name="psk:NorthAmerica4x6"><psf:Property name="psk:DisplayName"><psf:Value>(6x4)</psf:Value></psf:Property></psf:Option>
  </psf:Feature>
  <psf:Feature name="ns0000:Cutter">
    <psf:Property name="psk:DisplayName"><psf:Value>2inch cut</psf:Value></psf:Property>
    <psf:Option name="ns0000:Disable"><psf:Property name="psk:DisplayName"><psf:Value>Disable</psf:Value></psf:Property></psf:Option>
    <psf:Option name="ns0000:Enable"><psf:Property name="psk:DisplayName"><psf:Value>Enable</psf:Value></psf:Property></psf:Option>
  </psf:Feature>
</psf:PrintCapabilities>`

const TICKET = `<?xml version="1.0" encoding="UTF-8"?>
<psf:PrintTicket xmlns:psf="http://schemas.microsoft.com/windows/2003/08/printing/printschemaframework" xmlns:psk="http://schemas.microsoft.com/windows/2003/08/printing/printschemakeywords" version="1">
  <psf:Feature name="psk:PageMediaSize"><psf:Option name="psk:NorthAmerica4x6" /></psf:Feature>
</psf:PrintTicket>`

describe('2x6 cut queue', () => {
  it('names the strip queue so detection recognises it', () => {
    expect(stripQueueName('DS-RX1')).toBe('DS-RX1 (2x6 cut)')
    expect(stripQueueName('DNP DS-RX1HS')).toMatch(/2x6 cut/)
  })

  it("finds the driver's cut feature and its 'on' option", () => {
    expect(findCutOption(CAPS)).toEqual({ feature: 'ns0000:Cutter', option: 'ns0000:Enable', off: 'ns0000:Disable', namespace: { prefix: 'ns0000', uri: 'http://schemas.dnp.co.jp/ds-rx1' } })
  })

  it('prefers a "2 inch" option over a generic one, and never picks off/none', () => {
    const caps = CAPS.replace('<psf:Option name="ns0000:Enable">', '<psf:Option name="ns0000:Cut2inch"><psf:Property name="psk:DisplayName"><psf:Value>2inch Cut</psf:Value></psf:Property></psf:Option><psf:Option name="ns0000:Enable">')
    expect(findCutOption(caps)?.option).toBe('ns0000:Cut2inch')
    const onlyOff = CAPS.replace(/<psf:Option name="ns0000:Enable">[\s\S]*?<\/psf:Option>/, '')
    expect(findCutOption(onlyOff)).toBeNull()
  })

  it("returns null when the driver keeps the cut setting private", () => {
    expect(findCutOption(CAPS.replace(/<psf:Feature name="ns0000:Cutter">[\s\S]*?<\/psf:Feature>/, ''))).toBeNull()
    expect(findCutOption('not xml')).toBeNull()
  })

  it('adds the option to a ticket, declaring the namespace, or replaces an existing choice', () => {
    const cut = findCutOption(CAPS)!
    const added = withOption(TICKET, cut)
    expect(added).toContain('xmlns:ns0000="http://schemas.dnp.co.jp/ds-rx1"')
    expect(added).toContain('<psf:Feature name="ns0000:Cutter"><psf:Option name="ns0000:Enable" /></psf:Feature>')
    expect(added).toContain('psk:NorthAmerica4x6') // other settings kept
    const off = added.replace('ns0000:Enable', 'ns0000:Disable')
    const replaced = withOption(off, cut)
    expect(replaced.match(/ns0000:Cutter/g)).toHaveLength(1)
    expect(replaced).toContain('<psf:Option name="ns0000:Enable" />')
  })
})
