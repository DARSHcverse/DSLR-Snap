import type { DeviceSettings } from '../shared/types'

/**
 * Settings saved from the Printer & devices screen. That screen loads them once and saves the
 * whole object back, so its copy of the camera presets can be out of date (they also change from
 * the Camera screen and from other booths through the account). Presets are only ever changed with
 * saveCameraPresets; anything here keeps the stored list.
 */
export function fromScreen(stored: DeviceSettings, incoming: DeviceSettings): DeviceSettings {
  return { ...incoming, cameraPresets: stored.cameraPresets ?? [] }
}
