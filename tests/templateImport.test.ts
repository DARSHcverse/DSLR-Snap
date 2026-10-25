import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { detectSlots, guessLayout, normalizeArtwork, suggestFit } from '../src/main/compose/templateImport'
import { canvasSize } from '../src/shared/layout'
import type { Rect } from '../src/shared/types'

const strip = canvasSize('2x6', 'portrait')

/** Solid image with optional rectangles punched out (transparent) or painted on. */
async function design(w: number, h: number, bg: string, rects: { r: Rect; fill?: string }[] = []): Promise<Buffer> {
  const shapes = rects.map(({ r, fill }) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${fill ?? 'black'}"/>`).join('')
  const art = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${bg}"/>${shapes}</svg>`)
  if (rects.some((x) => x.fill)) return sharp(art).png().toBuffer()
  // Punch holes: use the rectangles as an alpha mask.
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="white"/>${shapes}</svg>`)
  const alpha = await sharp(mask).greyscale().raw().toBuffer()
  const rgb = await sharp(art).removeAlpha().raw().toBuffer()
  return sharp(rgb, { raw: { width: w, height: h, channels: 3 } }).joinChannel(alpha, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer()
}

/** True if `outer` fully covers `inner` (so no background shows through a hole). */
const covers = (outer: Rect, inner: Rect) =>
  outer.x <= inner.x && outer.y <= inner.y && outer.x + outer.w >= inner.x + inner.w && outer.y + outer.h >= inner.y + inner.h

describe('guessLayout', () => {
  it.each([
    [600, 1800, '2x6', 'portrait'],
    [1200, 3600, '2x6', 'portrait'],
    [1024, 1536, '4x6', 'portrait'],
    [1800, 1200, '4x6', 'landscape']
  ])('%i×%i → %s %s', (w, h, format, orientation) => {
    expect(guessLayout(w, h)).toEqual({ format, orientation })
  })
})

describe('suggestFit', () => {
  it('stretches when the shape is already right', () => {
    expect(suggestFit(600, 1800, { format: '2x6', orientation: 'portrait' })).toBe('stretch')
  })
  it('fits inside (no crop, no distortion) when the shape is wrong', () => {
    expect(suggestFit(1024, 1536, { format: '2x6', orientation: 'portrait' })).toBe('fit')
  })
})

describe('normalizeArtwork', () => {
  it('resizes to the print canvas and keeps transparency', async () => {
    const out = await normalizeArtwork(await design(600, 1800, '#ff0000', [{ r: { x: 60, y: 60, w: 480, h: 500 } }]), { format: '2x6', orientation: 'portrait' }, 'stretch')
    const m = await sharp(out).metadata()
    expect([m.width, m.height, m.hasAlpha]).toEqual([strip.w, strip.h, true])
  })

  it('pads with the design colour when fitting a wrong-shaped image', async () => {
    const out = await normalizeArtwork(await design(1000, 1000, '#00ff00'), { format: '2x6', orientation: 'portrait' }, 'fit')
    const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true })
    const top = Array.from(data.subarray(0, info.channels)) // padding area above the square
    expect(top.slice(0, 3)).toEqual([0, 255, 0])
    expect(top[3]).toBe(255)
  })

  it('rejects files that are not images', async () => {
    await expect(normalizeArtwork(Buffer.from('not an image'), { format: '2x6', orientation: 'portrait' }, 'fit')).rejects.toThrow(/PNG or JPG/)
  })
})

describe('detectSlots', () => {
  it('finds transparent photo holes in a Canva-style strip, top to bottom, fully covering each hole', async () => {
    const holes = [
      { x: 60, y: 60, w: 480, h: 440 },
      { x: 60, y: 540, w: 480, h: 440 },
      { x: 60, y: 1020, w: 480, h: 440 }
    ]
    const png = await normalizeArtwork(await design(600, 1800, '#f4c2c2', holes.map((r) => ({ r }))), { format: '2x6', orientation: 'portrait' }, 'stretch')
    const res = await detectSlots(png)
    expect(res.method).toBe('transparent')
    expect(res.layer).toBe('over')
    expect(res.slots).toHaveLength(3)
    const sx = strip.w / 600
    const sy = strip.h / 1800
    res.slots.forEach((s, i) => {
      const h = holes[i]
      const scaled = { x: Math.ceil(h.x * sx), y: Math.ceil(h.y * sy), w: Math.floor(h.w * sx), h: Math.floor(h.h * sy) }
      expect(covers(s, scaled)).toBe(true)
      expect(s.w - scaled.w).toBeLessThan(10) // and not much bigger
      expect(s.h - scaled.h).toBeLessThan(10)
    })
  })

  it('orders a 2×2 grid left-to-right, then top-to-bottom', async () => {
    const holes = [
      { x: 640, y: 60, w: 540, h: 680 },
      { x: 60, y: 780, w: 540, h: 680 },
      { x: 60, y: 60, w: 540, h: 680 },
      { x: 640, y: 780, w: 540, h: 680 }
    ]
    const png = await normalizeArtwork(await design(1248, 1844, '#ffffff', holes.map((r) => ({ r }))), { format: '4x6', orientation: 'portrait' }, 'stretch')
    const { slots } = await detectSlots(png)
    expect(slots.map((s) => [s.x < 300 ? 'L' : 'R', s.y < 500 ? 'T' : 'B'])).toEqual([['L', 'T'], ['R', 'T'], ['L', 'B'], ['R', 'B']])
  })

  it('ignores transparent areas too small to be a photo', async () => {
    // ~0.7% of the canvas: enough to count as a see-through design, too small for a photo box.
    const png = await normalizeArtwork(await design(600, 1800, '#ffffff', [{ r: { x: 100, y: 100, w: 80, h: 90 } }]), { format: '2x6', orientation: 'portrait' }, 'stretch')
    const res = await detectSlots(png)
    expect(res.slots).toEqual([])
    expect(res.layer).toBe('over') // still has transparency, so the design goes on top
  })

  it('suggests photo boxes from flat placeholder rectangles in a solid (ChatGPT-style) design', async () => {
    const boxes = [
      { x: 70, y: 90, w: 460, h: 420 },
      { x: 70, y: 560, w: 460, h: 420 },
      { x: 70, y: 1030, w: 460, h: 420 }
    ]
    const rects = boxes.flatMap((r) => [
      { r, fill: '#d9d9d9' },
      { r: { x: r.x + r.w / 2 - 30, y: r.y + r.h / 2 - 20, w: 60, h: 40 }, fill: '#555555' } // "photo here" icon
    ])
    const png = await normalizeArtwork(await design(600, 1800, '#1f3b5a', rects), { format: '2x6', orientation: 'portrait' }, 'stretch')
    const res = await detectSlots(png)
    expect(res.method).toBe('placeholder')
    expect(res.layer).toBe('under')
    expect(res.slots).toHaveLength(3)
    expect(res.slots[0].y).toBeLessThan(res.slots[1].y)
  })

  it('finds nothing in a plain design and puts it behind the photos', async () => {
    const png = await normalizeArtwork(await design(600, 1800, '#ffffff'), { format: '2x6', orientation: 'portrait' }, 'stretch')
    expect(await detectSlots(png)).toEqual({ slots: [], method: 'none', layer: 'under' })
  })
})
