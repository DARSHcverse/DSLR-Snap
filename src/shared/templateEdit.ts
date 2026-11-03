import { canvasSize } from './layout'
import type { Template, TextItem } from './types'

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
