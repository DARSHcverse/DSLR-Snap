import type { EventEmitter } from 'node:events'
import type { CameraStatus, ExposureKey, ExposureState } from '../../shared/types'

/**
 * A camera the booth can trigger. Implementations must keep SDK-specific details out of
 * the rest of the app. Emits 'status' (CameraStatus) whenever connection state changes,
 * and 'exposure' when exposure settings change on the camera itself (dial turned, lens zoomed).
 */
export interface CameraAdapter extends EventEmitter {
  readonly driver: CameraStatus['driver']
  connect(): Promise<void>
  disconnect(): Promise<void>
  getStatus(): CameraStatus
  /** Triggers the shutter and saves the full-resolution JPEG into `dir`. Returns the file path. */
  capture(dir: string): Promise<string>
  /** Optional live preview. Returns a JPEG frame, or null if not available. */
  startLiveView(): Promise<boolean>
  getLiveViewFrame(): Promise<Buffer | null>
  stopLiveView(): Promise<void>
  getExposure(): Promise<ExposureState>
  /** `value` must be one of `getExposure().options[key]`. Returns the state after the change. */
  setExposure(key: ExposureKey, value: string): Promise<ExposureState>
}
