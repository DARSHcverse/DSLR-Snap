import { EventEmitter } from 'node:events'
import type { CameraStatus, ExposureKey, ExposureState } from '../../shared/types'
import type { CameraAdapter } from './CameraAdapter'

const LIVE = new Set(['ready', 'busy'])

/**
 * "Automatic" camera: runs every brand's bridge side by side (Canon, Nikon) and uses whichever has a
 * camera plugged in. Swap a Canon for a Nikon mid-event and it follows. Each bridge only sees its own
 * brand, so they don't compete for the camera.
 */
export class AnyCamera extends EventEmitter implements CameraAdapter {
  constructor(private cameras: CameraAdapter[]) {
    super()
    for (const c of cameras) {
      c.on('status', () => this.emit('status', this.getStatus()))
      c.on('exposure', () => c === this.active && this.emit('exposure'))
      c.on('log', (m: string) => this.emit('log', `${c.driver}: ${m}`))
    }
  }

  private get active(): CameraAdapter | undefined {
    return this.cameras.find((c) => LIVE.has(c.getStatus().state))
  }

  get driver(): CameraStatus['driver'] {
    return (this.active ?? this.cameras[0]).driver
  }

  getStatus(): CameraStatus {
    const active = this.active
    if (active) return active.getStatus()
    const all = this.cameras.map((c) => c.getStatus())
    const connecting = all.find((s) => s.state === 'connecting')
    if (connecting) return connecting
    return { driver: this.cameras[0].driver, state: 'disconnected', liveViewSupported: false, message: 'No camera found. Connect a Canon or Nikon by USB and switch it on.' }
  }

  /** Starts every bridge; fine as long as one finds a camera (the others keep looking). */
  async connect(): Promise<void> {
    const results = await Promise.allSettled(this.cameras.map((c) => c.connect()))
    if (!results.some((r) => r.status === 'fulfilled')) {
      throw new Error('No camera found. Connect a Canon or Nikon by USB and switch it on.')
    }
  }

  async disconnect(): Promise<void> {
    await Promise.allSettled(this.cameras.map((c) => c.disconnect()))
  }

  private use(): CameraAdapter {
    const a = this.active
    if (!a) throw new Error(this.getStatus().message ?? 'Camera not ready')
    return a
  }

  async capture(dir: string): Promise<string> {
    return this.use().capture(dir)
  }

  async startLiveView(): Promise<boolean> {
    return this.active ? this.active.startLiveView() : false
  }

  async getLiveViewFrame(): Promise<Buffer | null> {
    return this.active ? this.active.getLiveViewFrame() : null
  }

  async stopLiveView(): Promise<void> {
    await this.active?.stopLiveView()
  }

  async getExposure(): Promise<ExposureState> {
    return this.use().getExposure()
  }

  async setExposure(key: ExposureKey, value: string): Promise<ExposureState> {
    return this.use().setExposure(key, value)
  }
}
