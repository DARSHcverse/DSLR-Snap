import { describe, expect, it } from 'vitest'
import { BUILT_IN_TEMPLATES } from '../src/shared/templates'
import { copyName, FONTS, sanitizeTemplate } from '../src/shared/templateEdit'
import type { Template } from '../src/shared/types'

const imported: Template = {
  id: 'imported-0a1b2c3d', name: '  Wedding strip  ', format: '2x6', orientation: 'landscape', background: 'red',
  overlayPath: '/evil/path.png', slots: [{ x: 10.4, y: 20.6, w: 300, h: 200 }], texts: []
}

describe('sanitizeTemplate', () => {
  it('puts imported artwork where the app says, never where the editor says', () => {
    const t = sanitizeTemplate(imported, { artworkPath: '/app/templates/imported-0a1b2c3d.png' })
    expect(t.overlayPath).toBe('/app/templates/imported-0a1b2c3d.png')
    expect(t).toMatchObject({ name: 'Wedding strip', orientation: 'portrait', background: '#ffffff', slots: [{ x: 10, y: 21, w: 300, h: 200 }] })
    const behind = sanitizeTemplate({ ...imported, overlayPath: undefined, backgroundPath: '/x' }, { artworkPath: '/a.png' })
    expect(behind.backgroundPath).toBe('/a.png')
    expect(behind.overlayPath).toBeUndefined()
  })

  it('keeps a drawn template drawn: its colour and text, and no file paths from the editor', () => {
    const t = sanitizeTemplate({ ...BUILT_IN_TEMPLATES[0], overlayPath: '/evil.png' })
    expect(t.overlayPath).toBeUndefined()
    expect(t.backgroundPath).toBeUndefined()
    expect(t.background).toBe(BUILT_IN_TEMPLATES[0].background)
    expect(t.texts.map((x) => x.text)).toEqual(['{event}', '{date}'])
    // Every built-in's look survives a save unchanged (fonts, sizes, colours).
    for (const b of BUILT_IN_TEMPLATES) expect(sanitizeTemplate(b).texts).toEqual(b.texts.map((x) => ({ weight: 'normal', align: 'middle', fontFamily: FONTS[0].family, ...x })))
  })

  it('cleans text: trims, drops empty, clamps to the canvas, only known fonts and colours', () => {
    const t = sanitizeTemplate({
      ...imported,
      texts: [
        { text: '  #PriyaAndTom\n2026 ', x: 99999, y: -5, size: 2, color: 'javascript:alert(1)', fontFamily: '"><script>', weight: 'bold', align: 'start' },
        { text: '   ', x: 0, y: 0, size: 40, color: '#000000' }
      ]
    })
    expect(t.texts).toEqual([{ text: '#PriyaAndTom 2026', x: 624, y: 0, size: 10, color: '#1d1d1f', fontFamily: FONTS[0].family, weight: 'bold', align: 'start' }])
  })

  it('refuses an unknown layout and keeps at most 8 photos and 10 texts', () => {
    expect(() => sanitizeTemplate({ ...imported, format: '5x7' as never })).toThrow(/layout/)
    const many = sanitizeTemplate({
      ...imported,
      slots: Array.from({ length: 12 }, () => ({ x: 0, y: 0, w: 100, h: 100 })),
      texts: Array.from({ length: 14 }, (_, i) => ({ text: `t${i}`, x: 10, y: 10, size: 20, color: '#000000' }))
    })
    expect(many.slots).toHaveLength(8)
    expect(many.texts).toHaveLength(10)
  })
})

describe('copyName', () => {
  it('adds (copy), then numbers it, without stacking', () => {
    expect(copyName('Strip', [])).toBe('Strip (copy)')
    expect(copyName('Strip', ['Strip (copy)'])).toBe('Strip (copy 2)')
    expect(copyName('Strip (copy)', ['Strip (copy)'])).toBe('Strip (copy 2)')
  })
})
