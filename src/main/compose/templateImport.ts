import sharp from 'sharp'
import { canvasSize } from '../../shared/layout'
import { BUILT_IN_TEMPLATES } from '../../shared/templates'
import type { FitMode, Orientation, PrintFormat, Rect } from '../../shared/types'

/**
 * Turns a design made elsewhere (Canva, ChatGPT, Photoshop) into template artwork.
 * Pure image work, no Electron, so it is unit tested directly.
 */

export interface Layout {
  format: PrintFormat
  orientation: Orientation
}

const LAYOUTS: Layout[] = [
  { format: '2x6', orientation: 'portrait' },
  { format: '4x6', orientation: 'portrait' },
  { format: '4x6', orientation: 'landscape' }
]

const ratio = (l: Layout) => {
  const c = canvasSize(l.format, l.orientation)
  return c.h / c.w
}

/** Nearest print layout by shape. Compared in log space so 2:1 and 1:2 are equally far from 1:1. */
export function guessLayout(w: number, h: number): Layout {
  const r = Math.log(h / w)
  return LAYOUTS.reduce((best, l) => (Math.abs(Math.log(ratio(l)) - r) < Math.abs(Math.log(ratio(best)) - r) ? l : best))
}

/** Starting photo boxes when none were found in the design: the matching built-in layout's slots. */
export function defaultSlots(layout: Layout): Rect[] {
  const t = BUILT_IN_TEMPLATES.find((b) => b.format === layout.format && b.orientation === layout.orientation && b.slots.length > 1)
  return (t?.slots ?? []).map((s) => ({ ...s }))
}

/** Stretch when the shape is already close (the distortion is invisible), otherwise fit without cropping. */
export function suggestFit(w: number, h: number, layout: Layout): FitMode {
  return Math.abs(Math.log(h / w / ratio(layout))) < 0.06 ? 'stretch' : 'fit'
}

/** Returns an RGBA PNG exactly the size of the layout's design canvas. */
export async function normalizeArtwork(src: string | Buffer, layout: Layout, fit: FitMode): Promise<Buffer> {
  const size = canvasSize(layout.format, layout.orientation)
  try {
    // The padding colour for "fit" comes from the design's top-left corner, so borders blend in.
    const corner = await sharp(src).rotate().resize(8, 8, { fit: 'fill' }).ensureAlpha().raw().toBuffer()
    const background = corner[3] < 128 ? { r: 255, g: 255, b: 255, alpha: 1 } : { r: corner[0], g: corner[1], b: corner[2], alpha: 1 }
    const resizeFit = fit === 'stretch' ? 'fill' : fit === 'fill' ? 'cover' : 'contain'
    return await sharp(src).rotate().resize(size.w, size.h, { fit: resizeFit, position: 'centre', background }).ensureAlpha().png().toBuffer()
  } catch {
    throw new Error("Couldn't read that file. Export your design as a PNG or JPG and try again.")
  }
}

export interface SlotDetection {
  slots: Rect[]
  method: 'transparent' | 'placeholder' | 'none'
  /** 'over': design drawn on top of photos (it has see-through holes). 'under': design behind photos. */
  layer: 'over' | 'under'
}

interface Region {
  area: number
  x0: number
  y0: number
  x1: number
  y1: number
}

/**
 * Labels 4-connected regions. `seedOk` decides which pixels can start a region, `joins(seed, p)`
 * whether pixel p belongs to the region grown from `seed`.
 */
function regions(w: number, h: number, seedOk: (p: number) => boolean, joins: (seed: number, p: number) => boolean): Region[] {
  const seen = new Uint8Array(w * h)
  const queue = new Int32Array(w * h)
  const out: Region[] = []
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || !seedOk(start)) continue
    const r: Region = { area: 0, x0: w, y0: h, x1: 0, y1: 0 }
    let head = 0
    let tail = 0
    queue[tail++] = start
    seen[start] = 1
    while (head < tail) {
      const p = queue[head++]
      const x = p % w
      const y = (p - x) / w
      r.area++
      if (x < r.x0) r.x0 = x
      if (x > r.x1) r.x1 = x
      if (y < r.y0) r.y0 = y
      if (y > r.y1) r.y1 = y
      const neighbours = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]
      for (const n of neighbours) {
        if (n >= 0 && !seen[n] && joins(start, n)) {
          seen[n] = 1
          queue[tail++] = n
        }
      }
    }
    out.push(r)
  }
  return out
}

const boxArea = (r: Region) => (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1)

/** Reading order: rows top to bottom (boxes whose centres are within half a box height share a row), then left to right. */
function readingOrder(slots: Rect[]): Rect[] {
  const sorted = [...slots].sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2))
  const rows: Rect[][] = []
  for (const s of sorted) {
    const row = rows[rows.length - 1]
    if (row && Math.abs(s.y + s.h / 2 - (row[0].y + row[0].h / 2)) < Math.min(s.h, row[0].h) / 2) row.push(s)
    else rows.push([s])
  }
  return rows.flatMap((row) => row.sort((a, b) => a.x - b.x))
}

const MAX_SLOTS = 8

/**
 * Finds where photos go in normalized artwork.
 * 1. See-through holes (Canva "transparent background" exports): design goes on top of photos.
 * 2. Otherwise, flat rectangular placeholder boxes not touching the edge (typical ChatGPT designs):
 *    design goes behind photos. These are suggestions; the operator confirms them in the editor.
 */
export async function detectSlots(png: Buffer): Promise<SlotDetection> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info
  const total = w * h
  const alpha = (p: number) => data[p * 4 + 3]

  let seeThrough = 0
  for (let p = 0; p < total; p++) if (alpha(p) < 250) seeThrough++

  if (seeThrough / total > 0.005) {
    const holes = regions(w, h, (p) => alpha(p) < 128, (_s, p) => alpha(p) < 128)
      .filter((r) => r.area >= total * 0.015 && r.area / boxArea(r) >= 0.7)
      .slice(0, MAX_SLOTS)
    // Grow each box a little so anti-aliased hole edges are covered by photo, never by the background colour.
    const pad = 2
    const slots = holes.map((r) => {
      const x = Math.max(0, r.x0 - pad)
      const y = Math.max(0, r.y0 - pad)
      return { x, y, w: Math.min(w - 1, r.x1 + pad) - x + 1, h: Math.min(h - 1, r.y1 + pad) - y + 1 }
    })
    return { slots: readingOrder(slots), method: slots.length ? 'transparent' : 'none', layer: 'over' }
  }

  // Flat-colour regions; tolerance absorbs JPEG noise and soft gradients.
  const tol = 18
  const close = (a: number, b: number) =>
    Math.abs(data[a * 4] - data[b * 4]) <= tol && Math.abs(data[a * 4 + 1] - data[b * 4 + 1]) <= tol && Math.abs(data[a * 4 + 2] - data[b * 4 + 2]) <= tol
  const boxes = regions(w, h, () => true, close)
    .filter((r) => {
      const bw = r.x1 - r.x0 + 1
      const bh = r.y1 - r.y0 + 1
      const touchesEdge = r.x0 === 0 || r.y0 === 0 || r.x1 === w - 1 || r.y1 === h - 1
      return !touchesEdge && boxArea(r) >= total * 0.02 && boxArea(r) <= total * 0.6 && r.area / boxArea(r) >= 0.8 && bw / bh >= 1 / 3 && bw / bh <= 3
    })
    .slice(0, MAX_SLOTS)
    .map((r) => ({ x: r.x0, y: r.y0, w: r.x1 - r.x0 + 1, h: r.y1 - r.y0 + 1 }))
  return boxes.length ? { slots: readingOrder(boxes), method: 'placeholder', layer: 'under' } : { slots: [], method: 'none', layer: 'under' }
}
