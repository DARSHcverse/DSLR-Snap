import { canvasSize, SAFE_MARGIN } from './layout'
import type { Rect, Template, TextItem } from './types'

/**
 * Template editing rules shared by the editor (renderer) and saving (main). Saving never trusts the
 * editor: everything goes through sanitizeTemplate, which also decides where the artwork lives.
 */

/** Fonts offered for text on a print; the value goes straight into the SVG the composer draws. */
export const FONTS = [
  { id: 'sans', label: 'Modern', family: 'Helvetica, Arial, sans-serif' },
  { id: 'serif', label: 'Elegant', family: 'Georgia, serif' },
  { id: 'script', label: 'Script', family: '"Brush Script MT", "Segoe Script", cursive' },
  { id: 'mono', label: 'Typewriter', family: '"Courier New", Courier, monospace' }
] as const

export const MAX_SLOTS = 8
export const MAX_TEXTS = 10
const HEX = /^#[0-9a-f]{6}$/i
const FAMILIES = new Set<string>(FONTS.map((f) => f.family))

const clampN = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback
}

function cleanText(t: TextItem, c: { w: number; h: number }): TextItem | null {
  const text = String(t.text ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 80)
  if (!text) return null
  return {
    text,
    x: clampN(t.x, 0, c.w, c.w / 2),
    y: clampN(t.y, 0, c.h, c.h / 2),
    size: clampN(t.size, 10, 300, 40),
    color: HEX.test(t.color) ? t.color : '#1d1d1f',
    fontFamily: t.fontFamily && FAMILIES.has(t.fontFamily) ? t.fontFamily : FONTS[0].family,
    weight: t.weight === 'bold' ? 'bold' : 'normal',
    align: t.align === 'start' || t.align === 'end' ? t.align : 'middle'
  }
}

/** Smallest QR that phones still scan reliably from a print (about 1 cm at 300 dpi). */
export const MIN_QR = 120

function cleanQr(r: Rect, c: { w: number; h: number }): Rect {
  const size = clampN(Math.min(r.w, r.h), MIN_QR, Math.min(c.w, c.h), MIN_QR)
  return { x: clampN(r.x, 0, c.w - size, 0), y: clampN(r.y, 0, c.h - size, 0), w: size, h: size }
}

/**
 * A template as it may be saved. `artworkPath` is where an imported design's file lives (main
 * decides, never the editor); without it the template is drawn (background colour, photos, text).
 * `keep` carries over what only the app sets, like a built-in's logo.
 */
export function sanitizeTemplate(t: Template, opts: { artworkPath?: string; keep?: Pick<Template, 'logo'> } = {}): Template {
  if (!['2x6', '4x6'].includes(t.format) || !['portrait', 'landscape'].includes(t.orientation)) throw new Error('Unknown print layout.')
  const orientation = t.format === '2x6' ? 'portrait' : t.orientation
  const c = canvasSize(t.format, orientation)
  return {
    id: t.id,
    name: String(t.name ?? '').trim().slice(0, 80),
    format: t.format,
    orientation,
    background: HEX.test(t.background) ? t.background : '#ffffff',
    ...(opts.artworkPath ? (t.overlayPath ? { overlayPath: opts.artworkPath } : { backgroundPath: opts.artworkPath }) : {}),
    ...(opts.keep?.logo ? { logo: opts.keep.logo } : {}),
    ...(t.qr ? { qr: cleanQr(t.qr, c) } : {}),
    slots: (t.slots ?? []).slice(0, MAX_SLOTS).map((s) => ({ x: Math.round(s.x), y: Math.round(s.y), w: Math.round(s.w), h: Math.round(s.h) })),
    texts: (t.texts ?? []).slice(0, MAX_TEXTS).flatMap((x) => cleanText(x, c) ?? [])
  }
}

/** "Classic strip (copy)", "Classic strip (copy 2)"… for "Save as a copy". */
export function copyName(name: string, taken: string[]): string {
  const base = name.replace(/ \(copy(?: \d+)?\)$/, '')
  for (let n = 1; ; n++) {
    const candidate = `${base} (copy${n > 1 ? ` ${n}` : ''})`
    if (!taken.includes(candidate)) return candidate.slice(0, 80)
  }
}

/** The photo moved to the middle of the canvas, left to right. */
export function centreX(r: Rect, c: { w: number }): Rect {
  return { ...r, x: Math.round((c.w - r.w) / 2) }
}

/**
 * Equal gaps between photos, top to bottom: the top and bottom photos stay put and the ones in
 * between move. Photos keep their order on the print (and their index, which is the shot order).
 */
export function spaceEvenly(slots: Rect[]): Rect[] {
  if (slots.length < 3) return slots
  const order = slots.map((s, i) => ({ s, i })).sort((a, b) => a.s.y - b.s.y)
  const top = order[0].s.y
  const bottom = order[order.length - 1].s.y + order[order.length - 1].s.h
  const gap = (bottom - top - order.reduce((n, o) => n + o.s.h, 0)) / (order.length - 1)
  const out = [...slots]
  let y = top
  for (const o of order) {
    out[o.i] = { ...o.s, y: Math.round(y) }
    y += o.s.h + gap
  }
  return out
}

/**
 * A new line of text, centred near the bottom (where names and dates usually go). It goes under the
 * lowest existing text, or above the topmost one when there's no room left at the bottom, so new
 * lines never land on top of each other.
 */
export function newText(c: { w: number; h: number }, text: string, existing: TextItem[] = []): TextItem {
  const size = 40
  let y = Math.round(c.h * 0.88)
  if (existing.length) {
    const lowest = existing.reduce((a, b) => (b.y > a.y ? b : a))
    const topmost = existing.reduce((a, b) => (b.y < a.y ? b : a))
    const below = lowest.y + Math.round(size * 1.5)
    y = below <= c.h - SAFE_MARGIN ? below : Math.max(size + SAFE_MARGIN, topmost.y - Math.round(topmost.size * 1.5))
  }
  return { text, x: Math.round(c.w / 2), y, size, color: '#1d1d1f', fontFamily: FONTS[0].family, weight: 'normal', align: 'middle' }
}

/** Where a newly added QR code goes: bottom-right, inside the safe area. */
export function defaultQr(c: { w: number; h: number }): Rect {
  const size = Math.max(MIN_QR, Math.round(Math.min(c.w, c.h) * 0.28))
  return { x: c.w - SAFE_MARGIN - size, y: c.h - SAFE_MARGIN - size, w: size, h: size }
}
