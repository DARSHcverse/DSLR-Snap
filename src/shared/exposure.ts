import type { ExposureKey, ExposureSettings } from './types'

/**
 * Fastest shutter speed that still syncs with the flash. Faster than this, part of the frame
 * misses the flash and comes out as a dark band. 1/200 s is Canon's published X-sync for the
 * EOS R100 — confirm with a test shot on the real camera + flash and adjust here if needed.
 */
export const FLASH_SYNC_SECONDS = 1 / 200

/** "1/125" → 0.008, '0.5"' → 0.5, '30"' → 30. NaN for anything else (e.g. "Bulb"). */
export function shutterSeconds(label: string): number {
  const frac = label.match(/^1\/(\d+)$/)
  if (frac) return 1 / Number(frac[1])
  const secs = label.match(/^(\d+(?:\.\d+)?)"$/)
  return secs ? Number(secs[1]) : NaN
}

/** The booth always shoots with flash, so faster shutter speeds are never offered. */
export function flashSafe(shutters: string[]): string[] {
  // Small tolerance: Canon's nominal "1/200" is really 2^-7.625 s.
  return shutters.filter((s) => shutterSeconds(s) >= FLASH_SYNC_SECONDS * 0.98)
}

function numeric(key: ExposureKey, label: string): number {
  if (key === 'shutter') return shutterSeconds(label)
  return Number(label) // "Auto" ISO → NaN, never chosen as "nearest"
}

/** Closest value the camera offers, compared in stops (log scale). White balance must match exactly. */
export function nearestOption(key: ExposureKey, options: string[], target: string): string | undefined {
  if (options.includes(target)) return target
  if (key === 'whiteBalance') return undefined
  const t = numeric(key, target)
  if (!Number.isFinite(t)) return undefined
  let best: string | undefined
  let bestDist = Infinity
  for (const o of options) {
    const v = numeric(key, o)
    if (!Number.isFinite(v)) continue
    const d = Math.abs(Math.log2(v / t))
    if (d < bestDist) (best = o), (bestDist = d)
  }
  return best
}

/** Next/previous option, stopping at either end. */
export function step(options: string[], current: string | undefined, dir: 1 | -1): string | undefined {
  const i = current === undefined ? -1 : options.indexOf(current)
  if (i < 0) return options[0]
  return options[Math.min(options.length - 1, Math.max(0, i + dir))]
}

export interface Preset {
  id: string
  name: string
  hint: string
  settings: ExposureSettings
}

/**
 * Starting points for flash photography; the operator fine-tunes after a test shot.
 * Aperture f/5.6–8 keeps a group in focus; shutter mainly controls how much room light shows.
 */
export const PRESETS: Preset[] = [
  { id: 'standard', name: 'Standard', hint: 'Most indoor events', settings: { iso: '400', aperture: '5.6', shutter: '1/125', whiteBalance: 'Flash' } },
  { id: 'bright', name: 'Bright room', hint: 'Daylight venues, white walls', settings: { iso: '200', aperture: '8', shutter: '1/160', whiteBalance: 'Flash' } },
  { id: 'dark', name: 'Dark venue', hint: 'Party lighting; keeps some room light', settings: { iso: '800', aperture: '5.6', shutter: '1/60', whiteBalance: 'Flash' } },
  { id: 'outdoor', name: 'Outdoors', hint: 'Shade or overcast', settings: { iso: '100', aperture: '8', shutter: '1/200', whiteBalance: 'Flash' } }
]

export const EXPOSURE_LABELS: Record<ExposureKey, string> = { iso: 'ISO', aperture: 'Aperture', shutter: 'Shutter', whiteBalance: 'White balance' }

/** "ISO 400 · f/5.6 · 1/125 · Flash" */
export function describeExposure(s: ExposureSettings): string {
  return [s.iso && `ISO ${s.iso}`, s.aperture && `f/${s.aperture}`, s.shutter, s.whiteBalance].filter(Boolean).join(' · ')
}
