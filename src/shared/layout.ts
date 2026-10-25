import type { Orientation, PrintFormat, Rect, Template } from './types'

/**
 * Print geometry for dye-sub printers like the DNP DS-RX1HS (300 dpi).
 *
 * DNP drivers expect a 4x6 sheet *with bleed* (≈6.15" × 4.16"). 2x6 strips are printed as a
 * 4x6 sheet holding two identical strips side by side, with the driver's "2 inch cut" paper
 * option making the cut. These pixel sizes are the commonly used DNP values — confirm them
 * with a test print on the real printer and adjust here if the driver reports something else.
 */
export const DPI = 300
export const SHEET = { w: 1248, h: 1844 } as const // portrait 4x6 sheet incl. bleed
/** Keep important content this far from every sheet edge (bleed gets trimmed). */
export const SAFE_MARGIN = 36

/** Size of the canvas a template is designed on. */
export function canvasSize(format: PrintFormat, orientation: Orientation): { w: number; h: number } {
  if (format === '2x6') return { w: SHEET.w / 2, h: SHEET.h }
  return orientation === 'portrait' ? { w: SHEET.w, h: SHEET.h } : { w: SHEET.h, h: SHEET.w }
}

export interface TemplateIssue {
  level: 'error' | 'warning'
  message: string
}

function inside(r: Rect, c: { w: number; h: number }): boolean {
  return r.x >= 0 && r.y >= 0 && r.w > 0 && r.h > 0 && r.x + r.w <= c.w && r.y + r.h <= c.h
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

/** Validates a template before it can be used at an event. */
export function validateTemplate(t: Template): TemplateIssue[] {
  const issues: TemplateIssue[] = []
  if (t.format === '2x6' && t.orientation !== 'portrait') {
    issues.push({ level: 'error', message: '2x6 strips must be portrait.' })
  }
  if (t.slots.length === 0) issues.push({ level: 'error', message: 'Template needs at least one photo slot.' })
  const c = canvasSize(t.format, t.orientation)
  t.slots.forEach((s, i) => {
    if (!inside(s, c)) issues.push({ level: 'error', message: `Slot ${i + 1} is outside the ${c.w}×${c.h} canvas.` })
    else if (s.x < SAFE_MARGIN / 2 || s.y < SAFE_MARGIN / 2 || s.x + s.w > c.w - SAFE_MARGIN / 2 || s.y + s.h > c.h - SAFE_MARGIN / 2) {
      issues.push({ level: 'warning', message: `Slot ${i + 1} is close to the edge and may be trimmed.` })
    }
    t.slots.forEach((o, j) => {
      if (j > i && overlaps(s, o)) issues.push({ level: 'warning', message: `Slots ${i + 1} and ${j + 1} overlap.` })
    })
  })
  return issues
}

/** Replace {event} {date} {time} tokens in template text. */
export function fillTokens(text: string, vars: { event: string; date: Date }): string {
  const date = vars.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const time = vars.date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return text.replaceAll('{event}', vars.event).replaceAll('{date}', date).replaceAll('{time}', time)
}

/** Evenly stacked slots for a strip/sheet, leaving room at the bottom for branding. */
export function stackedSlots(
  count: number,
  canvas: { w: number; h: number },
  opts: { margin: number; gap: number; footer: number }
): Rect[] {
  const w = canvas.w - opts.margin * 2
  const h = Math.floor((canvas.h - opts.margin * 2 - opts.footer - opts.gap * (count - 1)) / count)
  return Array.from({ length: count }, (_, i) => ({ x: opts.margin, y: opts.margin + i * (h + opts.gap), w, h }))
}
