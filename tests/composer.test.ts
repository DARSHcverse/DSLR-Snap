import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { beforeAll, describe, expect, it } from 'vitest'
import { compose } from '../src/main/compose/composer'
import { canvasSize, SHEET, validateTemplate } from '../src/shared/layout'
import { BUILT_IN_TEMPLATES } from '../src/shared/templates'

const dir = mkdtempSync(join(tmpdir(), 'compose-'))
const photos: string[] = []

beforeAll(async () => {
  const colours = ['#ff0000', '#00ff00', '#0000ff', '#ffff00']
  for (let i = 0; i < 4; i++) {
    const p = join(dir, `p${i}.jpg`)
    await sharp({ create: { width: 600, height: 400, channels: 3, background: colours[i] } }).jpeg().toFile(p)
    photos.push(p)
  }
})

describe('built-in templates', () => {
  it.each(BUILT_IN_TEMPLATES.map((t) => [t.id, t] as const))('%s has no layout errors', (_id, t) => {
    expect(validateTemplate(t).filter((i) => i.level === 'error')).toEqual([])
  })
})

describe('compose', () => {
  it.each(BUILT_IN_TEMPLATES.map((t) => [t.id, t] as const))('%s produces correctly sized design and print sheet', async (_id, t) => {
    const out = await compose({ template: t, photoPaths: photos.slice(0, t.slots.length), eventName: 'Test & <Event>', date: new Date('2026-10-24') })
    const c = await sharp(out.composite).metadata()
    const p = await sharp(out.printSheet).metadata()
    expect([c.width, c.height]).toEqual([canvasSize(t.format, t.orientation).w, canvasSize(t.format, t.orientation).h])
    expect([p.width, p.height]).toEqual([SHEET.w, SHEET.h]) // printer always gets a portrait 4x6 sheet
    expect(p.density).toBe(300)
  })

  it('places photos in slots and duplicates 2x6 strips side by side', async () => {
    const t = BUILT_IN_TEMPLATES.find((x) => x.id === 'classic-strip-3')!
    const out = await compose({ template: t, photoPaths: photos.slice(0, 3), eventName: 'E' })
    const { data, info } = await sharp(out.printSheet).raw().toBuffer({ resolveWithObject: true })
    const px = (x: number, y: number) => Array.from(data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3))
    const s0 = t.slots[0]
    const cx = Math.round(s0.x + s0.w / 2)
    const cy = Math.round(s0.y + s0.h / 2)
    const left = px(cx, cy)
    const right = px(cx + SHEET.w / 2, cy)
    expect(left[0]).toBeGreaterThan(200) // red photo in slot 1
    expect(left[1]).toBeLessThan(60)
    expect(right).toEqual(left) // identical copy for the second strip
  })

  it('draws imported artwork behind photos (backgroundPath) or on top with see-through holes (overlayPath)', async () => {
    const c = canvasSize('2x6', 'portrait')
    const slot = { x: 100, y: 100, w: 300, h: 300 }
    const art = join(dir, 'art-blue.png')
    await sharp({ create: { width: c.w, height: c.h, channels: 4, background: '#0000ff' } }).png().toFile(art)
    // Same blue design but with a transparent hole where the slot is.
    const holed = join(dir, 'art-holed.png')
    await sharp(art)
      .composite([{ input: { create: { width: slot.w, height: slot.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } }, left: slot.x, top: slot.y, blend: 'dest-out' }])
      .png()
      .toFile(holed)

    const base = { id: 'imp', name: 'Imported', format: '2x6' as const, orientation: 'portrait' as const, background: '#ffffff', slots: [slot], texts: [] }
    const pixels = async (template: typeof base & { backgroundPath?: string; overlayPath?: string }) => {
      const out = await compose({ template, photoPaths: [photos[0]], eventName: 'E' }) // red photo
      const { data, info } = await sharp(out.composite).raw().toBuffer({ resolveWithObject: true })
      const px = (x: number, y: number) => Array.from(data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3))
      return { inSlot: px(250, 250), outside: px(500, 1000) }
    }

    const isRed = (p: number[]) => p[0] > 200 && p[2] < 60
    const isBlue = (p: number[]) => p[2] > 200 && p[0] < 60

    const under = await pixels({ ...base, backgroundPath: art })
    expect(isRed(under.inSlot)).toBe(true) // photo on top of the design
    expect(isBlue(under.outside)).toBe(true) // design visible around it

    const over = await pixels({ ...base, overlayPath: holed })
    expect(isRed(over.inSlot)).toBe(true) // photo shows through the hole
    expect(isBlue(over.outside)).toBe(true)
  })

  it('rejects too few photos', async () => {
    await expect(compose({ template: BUILT_IN_TEMPLATES[0], photoPaths: [photos[0]], eventName: 'E' })).rejects.toThrow(/needs 3 photos/)
  })
})
