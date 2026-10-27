import type { DeviceSettings } from '../shared/types'

type CameraDriver = Exclude<DeviceSettings['cameraDriver'], 'auto'>
type PrinterDriver = Exclude<DeviceSettings['printerDriver'], 'auto'>

/** "Automatic" camera: the Canon bridge on Windows when it is installed, the mock camera elsewhere (Mac development). */
export function resolveCameraDriver(setting: DeviceSettings['cameraDriver'], env: { platform: NodeJS.Platform; bridgeInstalled: boolean }): CameraDriver {
  if (setting !== 'auto') return setting
  return env.platform === 'win32' && env.bridgeInstalled ? 'canon-edsdk' : 'mock'
}

/** "Automatic" printer: the Windows driver on Windows (the DNP queue is then detected), the mock printer elsewhere. */
export function resolvePrinterDriver(setting: DeviceSettings['printerDriver'], platform: NodeJS.Platform): PrinterDriver {
  if (setting !== 'auto') return setting
  return platform === 'win32' ? 'windows-driver' : 'mock'
}
