import type { ExposureKey, ExposureState } from '../../shared/types'
import type { ExposureCodec } from './CanonBridgeCamera'

const KEYS: ExposureKey[] = ['iso', 'aperture', 'shutter', 'whiteBalance']

/**
 * The Nikon bridge decodes Nikon's values itself and answers get_exposure with plain labels in
 * ExposureState's own shape. This checks that shape, so a bridge bug can't put junk on screen.
 */
export function decodeLabelExposure(raw: unknown): ExposureState {
  const r = (raw ?? {}) as Partial<ExposureState>
  const options = Object.fromEntries(
    KEYS.map((k) => [k, Array.isArray(r.options?.[k]) ? r.options![k].filter((v): v is string => typeof v === 'string') : []])
  ) as ExposureState['options']
  const current = Object.fromEntries(KEYS.flatMap((k) => (typeof r.current?.[k] === 'string' ? [[k, r.current[k]]] : [])))
  return { mode: typeof r.mode === 'string' ? r.mode : '?', manual: r.manual === true, current, options }
}

export const NIKON_CODEC: ExposureCodec = {
  driver: 'nikon',
  decode: decodeLabelExposure,
  encode: (key, raw, value) => {
    const allowed = decodeLabelExposure(raw).options[key]
    if (!allowed.includes(value)) throw new Error(`The camera doesn't offer ${value} right now.`)
    return { key, value }
  }
}
