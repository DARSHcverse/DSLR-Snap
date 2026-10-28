import type { DeviceSettings } from '../shared/types'

type CameraDriver = Exclude<DeviceSettings['cameraDriver'], 'auto'>
type PrinterDriver = Exclude<DeviceSettings['printerDriver'], 'auto'>

/**
 * "Automatic" camera on Windows: every brand bridge that's installed ('any' = Canon and Nikon side by
 * side, whichever is plugged in); the mock camera elsewhere (Mac development) or when none is.
 */
export function resolveCameraDriver(
  setting: DeviceSettings['cameraDriver'],
  env: { platform: NodeJS.Platform; canonInstalled: boolean; nikonInstalled: boolean }
): CameraDriver | 'any' {
  if (setting !== 'auto') return setting
  if (env.platform !== 'win32') return 'mock'
  if (env.canonInstalled && env.nikonInstalled) return 'any'
  return env.canonInstalled ? 'canon-edsdk' : env.nikonInstalled ? 'nikon' : 'mock'
}

/** "Automatic" printer: the Windows driver on Windows (the DNP queue is then detected), the mock printer elsewhere. */
export function resolvePrinterDriver(setting: DeviceSettings['printerDriver'], platform: NodeJS.Platform): PrinterDriver {
  if (setting !== 'auto') return setting
  return platform === 'win32' ? 'windows-driver' : 'mock'
}
