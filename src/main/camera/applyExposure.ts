import { flashSafe, nearestOption } from '../../shared/exposure'
import type { ExposureKey, ExposureSettings, ExposureState } from '../../shared/types'
import type { CameraAdapter } from './CameraAdapter'

/** Camera state with shutter speeds the flash can't sync at removed. */
export async function readExposure(camera: CameraAdapter): Promise<ExposureState> {
  return withFlashSafeShutters(await camera.getExposure())
}

export function withFlashSafeShutters(s: ExposureState): ExposureState {
  return { ...s, options: { ...s.options, shutter: flashSafe(s.options.shutter) } }
}

/**
 * Applies saved settings, each snapped to the nearest value the camera currently allows
 * (the lens and zoom limit the aperture). Settings the camera won't take in its current mode
 * are skipped rather than failing, so a wrong mode dial never blocks the booth.
 */
export async function applyExposure(camera: CameraAdapter, wanted: ExposureSettings): Promise<{ state: ExposureState; skipped: ExposureKey[] }> {
  let state = await readExposure(camera)
  const skipped: ExposureKey[] = []
  for (const key of Object.keys(wanted) as ExposureKey[]) {
    const target = wanted[key]
    if (!target) continue
    const value = nearestOption(key, state.options[key], target)
    if (!value) {
      skipped.push(key)
      continue
    }
    if (value === state.current[key]) continue
    try {
      state = withFlashSafeShutters(await camera.setExposure(key, value))
    } catch {
      skipped.push(key)
    }
  }
  return { state, skipped }
}
