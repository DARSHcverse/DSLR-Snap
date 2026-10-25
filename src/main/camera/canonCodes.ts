import type { ExposureKey, ExposureState } from '../../shared/types'

/**
 * Canon EDSDK exposure property codes ↔ the labels the camera shows.
 * The bridge only passes raw codes; all naming lives here so it is unit tested on any OS.
 * Tables follow the EDSDK API reference (kEdsPropID_Av / _Tv / _ISOSpeed / _WhiteBalance / _AEMode).
 * EDSDK codes step by 8 per full stop (+3 / +5 = thirds, +4 = half stop), which the formula fallbacks use.
 */

const AV: Record<number, string> = {
  0x08: '1', 0x0b: '1.1', 0x0c: '1.2', 0x0d: '1.2', 0x10: '1.4', 0x13: '1.6', 0x14: '1.8', 0x15: '1.8',
  0x18: '2', 0x1b: '2.2', 0x1c: '2.5', 0x1d: '2.5', 0x20: '2.8', 0x23: '3.2', 0x85: '3.4', 0x24: '3.5', 0x25: '3.5',
  0x28: '4', 0x2b: '4.5', 0x2c: '4.5', 0x2d: '5', 0x30: '5.6', 0x33: '6.3', 0x34: '6.7', 0x35: '7.1',
  0x38: '8', 0x3b: '9', 0x3c: '9.5', 0x3d: '10', 0x40: '11', 0x43: '13', 0x44: '13', 0x45: '14',
  0x48: '16', 0x4b: '18', 0x4c: '19', 0x4d: '20', 0x50: '22', 0x53: '25', 0x54: '27', 0x55: '29',
  0x58: '32', 0x5b: '36', 0x5c: '38', 0x5d: '40', 0x60: '45', 0x63: '51', 0x64: '54', 0x65: '57',
  0x68: '64', 0x6b: '72', 0x6c: '76', 0x6d: '80', 0x70: '91'
}

const TV: Record<number, string> = {
  0x0c: 'Bulb', 0x10: '30"', 0x13: '25"', 0x14: '20"', 0x15: '20"', 0x18: '15"', 0x1b: '13"', 0x1c: '10"', 0x1d: '10"',
  0x20: '8"', 0x23: '6"', 0x24: '6"', 0x25: '5"', 0x28: '4"', 0x2b: '3.2"', 0x2c: '3"', 0x2d: '2.5"',
  0x30: '2"', 0x33: '1.6"', 0x34: '1.5"', 0x35: '1.3"', 0x38: '1"', 0x3b: '0.8"', 0x3c: '0.7"', 0x3d: '0.6"',
  0x40: '0.5"', 0x43: '0.4"', 0x44: '0.3"', 0x45: '0.3"', 0x48: '1/4', 0x4b: '1/5', 0x4c: '1/6', 0x4d: '1/6',
  0x50: '1/8', 0x53: '1/10', 0x54: '1/10', 0x55: '1/13', 0x58: '1/15', 0x5b: '1/20', 0x5c: '1/20', 0x5d: '1/25',
  0x60: '1/30', 0x63: '1/40', 0x64: '1/45', 0x65: '1/50', 0x68: '1/60', 0x6b: '1/80', 0x6c: '1/90', 0x6d: '1/100',
  0x70: '1/125', 0x73: '1/160', 0x74: '1/180', 0x75: '1/200', 0x78: '1/250', 0x7b: '1/320', 0x7c: '1/350', 0x7d: '1/400',
  0x80: '1/500', 0x83: '1/640', 0x84: '1/750', 0x85: '1/800', 0x88: '1/1000', 0x8b: '1/1250', 0x8c: '1/1500', 0x8d: '1/1600',
  0x90: '1/2000', 0x93: '1/2500', 0x94: '1/3000', 0x95: '1/3200', 0x98: '1/4000', 0x9b: '1/5000', 0x9c: '1/6000', 0x9d: '1/6400',
  0xa0: '1/8000'
}

const WB: Record<number, string> = { 0: 'Auto', 23: 'Auto (white)', 1: 'Daylight', 8: 'Shade', 2: 'Cloudy', 3: 'Tungsten', 4: 'Fluorescent', 5: 'Flash', 6: 'Custom', 9: 'Colour temp.' }

const MODES: Record<number, string> = {
  0: 'P', 1: 'Tv', 2: 'Av', 3: 'M', 4: 'Bulb', 9: 'Auto', 22: 'Auto', 19: 'Creative Auto',
  11: 'Sports', 12: 'Portrait', 13: 'Landscape', 14: 'Close-up', 15: 'Flash off', 25: 'Scene'
}

const ISO_NOMINAL = [6, 12, 25, 50, 64, 80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6400, 8000, 10000, 12800, 16000, 20000, 25600, 32000, 40000, 51200, 64000, 80000, 102400]
const AV_NOMINAL = [...new Set(Object.values(AV))].map(Number)

function nearest(values: number[], v: number): number {
  return values.reduce((a, b) => (Math.abs(Math.log(b / v)) < Math.abs(Math.log(a / v)) ? b : a))
}

export function isoLabel(code: number): string {
  if (code === 0) return 'Auto'
  return String(nearest(ISO_NOMINAL, 100 * 2 ** ((code - 0x48) / 8)))
}

export function avLabel(code: number): string {
  return AV[code] ?? String(nearest(AV_NOMINAL, 2 ** ((code - 0x08) / 16)))
}

export function tvLabel(code: number): string {
  if (TV[code]) return TV[code]
  const seconds = 2 ** (-(code - 0x38) / 8)
  return seconds >= 0.3 ? `${Math.round(seconds * 10) / 10}"` : `1/${Math.round(1 / seconds)}`
}

/** null for values the booth shouldn't offer (e.g. Canon's "click" or "pasted" white balance). */
export function wbLabel(code: number): string | null {
  return WB[code] ?? null
}

const LABEL: Record<ExposureKey, (code: number) => string | null> = { iso: isoLabel, aperture: avLabel, shutter: tvLabel, whiteBalance: wbLabel }

/** What the bridge sends for `get_exposure`: current code and the codes the camera accepts. */
export interface RawExposure {
  mode: number
  iso: RawProp
  av: RawProp
  tv: RawProp
  wb: RawProp
}
interface RawProp {
  value: number | null
  allowed: number[]
}

export const BRIDGE_PROP: Record<ExposureKey, 'iso' | 'av' | 'tv' | 'wb'> = { iso: 'iso', aperture: 'av', shutter: 'tv', whiteBalance: 'wb' }

function labels(key: ExposureKey, codes: number[]): string[] {
  const out: string[] = []
  for (const c of codes) {
    const l = LABEL[key](c)
    if (l !== null && !out.includes(l)) out.push(l)
  }
  return out
}

export function decodeExposure(raw: RawExposure): ExposureState {
  const keys = Object.keys(BRIDGE_PROP) as ExposureKey[]
  const current: ExposureState['current'] = {}
  const options = {} as ExposureState['options']
  for (const key of keys) {
    const p = raw[BRIDGE_PROP[key]]
    const label = p.value === null ? null : LABEL[key](p.value)
    if (label !== null) current[key] = label
    options[key] = labels(key, p.allowed)
  }
  return { mode: MODES[raw.mode] ?? (raw.mode < 0 ? '' : 'Other'), manual: raw.mode === 3, current, options }
}

/** The code to send for a label, chosen from what the camera currently offers. */
export function encodeOption(key: ExposureKey, allowed: number[], label: string): number {
  const code = allowed.find((c) => LABEL[key](c) === label)
  if (code === undefined) throw new Error(`${label} is not available on the camera right now.`)
  return code
}
