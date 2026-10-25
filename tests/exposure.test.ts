import sharp from 'sharp'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyzeShot } from '../src/main/camera/analyzeShot'
import { avLabel, decodeExposure, encodeOption, isoLabel, tvLabel, wbLabel } from '../src/main/camera/canonCodes'
import { applyExposure } from '../src/main/camera/applyExposure'
import { MockCamera } from '../src/main/camera/MockCamera'
import { flashSafe, nearestOption, PRESETS, shutterSeconds, step } from '../src/shared/exposure'

describe('Canon code → label', () => {
  it.each([[0x00, 'Auto'], [0x48, '100'], [0x4b, '125'], [0x4d, '160'], [0x58, '400'], [0x5d, '640'], [0x63, '1000'], [0x70, '3200'], [0x80, '12800']])('ISO 0x%s → %s', (code, label) => {
    expect(isoLabel(code)).toBe(label)
  })
  it.each([[0x28, '4'], [0x2b, '4.5'], [0x2c, '4.5'], [0x2d, '5'], [0x30, '5.6'], [0x33, '6.3'], [0x35, '7.1'], [0x38, '8'], [0x40, '11'], [0x50, '22']])('aperture 0x%s → f/%s', (code, label) => {
    expect(avLabel(code)).toBe(label)
  })
  it.each([[0x38, '1"'], [0x40, '0.5"'], [0x60, '1/30'], [0x68, '1/60'], [0x70, '1/125'], [0x73, '1/160'], [0x75, '1/200'], [0x78, '1/250'], [0xa0, '1/8000']])('shutter 0x%s → %s', (code, label) => {
    expect(tvLabel(code)).toBe(label)
  })
  it('names white balance modes and marks unknown ones', () => {
    expect([wbLabel(0), wbLabel(5), wbLabel(8)]).toEqual(['Auto', 'Flash', 'Shade'])
    expect(wbLabel(-1)).toBeNull()
  })
  it('falls back to the exposure formula for codes missing from the tables', () => {
    expect(avLabel(0x31)).toBe('5.6') // not a Canon code, but must not crash or show hex
  })
})

describe('decodeExposure / encodeOption', () => {
  const raw = {
    mode: 3,
    iso: { value: 0x58, allowed: [0x00, 0x48, 0x50, 0x58, 0x60] },
    av: { value: 0x30, allowed: [0x2d, 0x30, 0x33, 0x35, 0x38] },
    tv: { value: 0x70, allowed: [0x68, 0x6b, 0x6d, 0x70, 0x73, 0x75, 0x78] },
    wb: { value: 5, allowed: [0, 1, 2, 3, 4, 5, 6, 8, -1] }
  }

  it('turns raw codes into labels and reports manual mode', () => {
    const s = decodeExposure(raw)
    expect(s.mode).toBe('M')
    expect(s.manual).toBe(true)
    expect(s.current).toEqual({ iso: '400', aperture: '5.6', shutter: '1/125', whiteBalance: 'Flash' })
    expect(s.options.iso).toEqual(['Auto', '100', '200', '400', '800'])
    expect(s.options.whiteBalance).not.toContain(null) // unknown WB (-1) dropped
  })

  it('reports non-manual modes so the UI can ask for the M dial', () => {
    const s = decodeExposure({ ...raw, mode: 22, av: { value: 0x30, allowed: [] }, tv: { value: 0x70, allowed: [] } })
    expect(s).toMatchObject({ mode: 'Auto', manual: false })
    expect(s.options.aperture).toEqual([])
  })

  it('maps a label back to the code the camera offered', () => {
    expect(encodeOption('aperture', raw.av.allowed, '6.3')).toBe(0x33)
    expect(encodeOption('shutter', raw.tv.allowed, '1/200')).toBe(0x75)
    expect(() => encodeOption('iso', raw.iso.allowed, '6400')).toThrow(/not available/)
  })
})

describe('shared exposure helpers', () => {
  it('parses shutter speeds', () => {
    expect(shutterSeconds('1/125')).toBeCloseTo(0.008)
    expect(shutterSeconds('0.5"')).toBe(0.5)
    expect(shutterSeconds('30"')).toBe(30)
  })

  it('hides shutter speeds faster than the flash can sync', () => {
    expect(flashSafe(['1/60', '1/125', '1/200', '1/250', '1/4000'])).toEqual(['1/60', '1/125', '1/200'])
  })

  it('picks the nearest available value (lens may not open to the preset aperture)', () => {
    expect(nearestOption('aperture', ['6.3', '7.1', '8'], '5.6')).toBe('6.3')
    expect(nearestOption('shutter', ['1/60', '1/100', '1/125'], '1/120')).toBe('1/125')
    expect(nearestOption('iso', ['Auto', '100', '400'], '320')).toBe('400')
    expect(nearestOption('whiteBalance', ['Auto', 'Flash'], 'Flash')).toBe('Flash')
    expect(nearestOption('whiteBalance', ['Auto', 'Daylight'], 'Flash')).toBeUndefined()
    expect(nearestOption('iso', [], '400')).toBeUndefined()
  })

  it('steps through options and stops at the ends', () => {
    expect(step(['100', '200', '400'], '200', 1)).toBe('400')
    expect(step(['100', '200', '400'], '400', 1)).toBe('400')
    expect(step(['100', '200', '400'], '100', -1)).toBe('100')
  })

  it('every preset keeps the shutter within flash sync', () => {
    for (const p of PRESETS) expect(flashSafe([p.settings.shutter!])).toHaveLength(1)
  })
})

describe('applyExposure', () => {
  it('sets each saved value on the camera, using the nearest the camera allows', async () => {
    const cam = new MockCamera({ w: 300, h: 200 })
    await cam.connect()
    const res = await applyExposure(cam, { iso: '320', aperture: '2.8', shutter: '1/160', whiteBalance: 'Flash' })
    expect(res.state.current).toMatchObject({ iso: '320', shutter: '1/160', whiteBalance: 'Flash' })
    expect(res.state.current.aperture).toBe(cam.lensMaxAperture) // kit lens can't open to f/2.8
    expect(res.skipped).toEqual([])
  })

  it('skips settings the camera will not accept outside M mode, instead of failing', async () => {
    const cam = new MockCamera({ w: 300, h: 200 })
    await cam.connect()
    cam.mode = 'Auto'
    const res = await applyExposure(cam, { iso: '400', aperture: '8' })
    expect(res.skipped.sort()).toEqual(['aperture', 'iso'])
  })
})

describe('mock camera exposure', () => {
  it('makes photos brighter with a higher ISO, so test shots respond on a Mac', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'exp-'))
    const cam = new MockCamera({ w: 300, h: 200 })
    await cam.connect()
    await cam.setExposure('iso', '100')
    const dark = await analyzeShot(await cam.capture(dir))
    await cam.setExposure('iso', '1600')
    const bright = await analyzeShot(await cam.capture(dir))
    expect(bright.brightness).toBeGreaterThan(dark.brightness + 30)
  })
})

describe('analyzeShot', () => {
  const dir = mkdtempSync(join(tmpdir(), 'shot-'))
  const solid = async (name: string, v: number) => {
    const p = join(dir, name)
    await sharp({ create: { width: 200, height: 100, channels: 3, background: { r: v, g: v, b: v } } }).jpeg().toFile(p)
    return p
  }

  it('builds a 64-bin histogram and flags a dark shot', async () => {
    const a = await analyzeShot(await solid('dark.jpg', 20))
    expect(a.histogram).toHaveLength(64)
    expect(a.histogram.reduce((x, y) => x + y, 0)).toBeCloseTo(1)
    expect(a.verdict).toBe('dark')
  })

  it('flags blown-out highlights', async () => {
    expect((await analyzeShot(await solid('white.jpg', 255))).verdict).toBe('bright')
  })

  it('ignores a blown-out white backdrop around well-exposed guests', async () => {
    const p = join(dir, 'backdrop.jpg')
    // Pure white frame (backdrop) with a mid-tone subject filling the centre.
    await sharp({ create: { width: 600, height: 400, channels: 3, background: '#ffffff' } })
      .composite([{ input: { create: { width: 300, height: 260, channels: 3, background: { r: 130, g: 110, b: 100 } } }, left: 150, top: 70 }])
      .jpeg()
      .toFile(p)
    expect((await analyzeShot(p)).verdict).toBe('good')
  })

  it('calls a mid-grey shot good', async () => {
    expect((await analyzeShot(await solid('mid.jpg', 120))).verdict).toBe('good')
  })
})
