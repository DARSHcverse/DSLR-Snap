import { EventEmitter } from 'node:events'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { shutterSeconds } from '../../shared/exposure'
import type { CameraStatus, ExposureKey, ExposureSettings, ExposureState } from '../../shared/types'
import type { CameraAdapter } from './CameraAdapter'

const PALETTE = ['#ff6b6b', '#4ecdc4', '#ffd166', '#6a4c93', '#06d6a0', '#118ab2', '#ef476f', '#f78c6b']

// Roughly what an R100 with the RF-S 18-45mm kit lens offers (third stops).
const MOCK_OPTIONS: Record<ExposureKey, string[]> = {
  iso: ['Auto', '100', '125', '160', '200', '250', '320', '400', '500', '640', '800', '1000', '1250', '1600', '2000', '2500', '3200', '4000', '5000', '6400'],
  aperture: ['4.5', '5', '5.6', '6.3', '7.1', '8', '9', '10', '11', '13', '14', '16', '18', '20', '22'],
  shutter: ['1"', '0.5"', '1/4', '1/8', '1/15', '1/30', '1/40', '1/50', '1/60', '1/80', '1/100', '1/125', '1/160', '1/200', '1/250', '1/320', '1/400', '1/500', '1/1000', '1/2000', '1/4000'],
  whiteBalance: ['Auto', 'Daylight', 'Shade', 'Cloudy', 'Tungsten', 'Fluorescent', 'Flash']
}

/**
 * Development camera so the whole booth runs on a Mac or any PC without the Canon attached.
 * Generates 6000×4000 (R100-sized, 3:2) JPEGs with a numbered "subject".
 */
export class MockCamera extends EventEmitter implements CameraAdapter {
  readonly driver = 'mock' as const
  private status: CameraStatus = { driver: 'mock', state: 'disconnected', liveViewSupported: true }
  private shots = 0
  private frame = 0
  private exposure: ExposureSettings = { iso: '400', aperture: '5.6', shutter: '1/125', whiteBalance: 'Flash' }
  failNext = false
  /** Mode dial position; tests set this to simulate the dial not being on M. */
  mode = 'M'
  readonly lensMaxAperture = MOCK_OPTIONS.aperture[0]

  /** Defaults to R100-sized frames; previews pass something small for speed. */
  constructor(private size = { w: 6000, h: 4000 }) {
    super()
  }

  async connect(): Promise<void> {
    this.setStatus({ state: 'ready', model: `Mock camera (${this.size.w}×${this.size.h})` })
  }

  async disconnect(): Promise<void> {
    this.setStatus({ state: 'disconnected', model: undefined })
  }

  getStatus(): CameraStatus {
    return this.status
  }

  private setStatus(p: Partial<CameraStatus>): void {
    this.status = { ...this.status, ...p }
    this.emit('status', this.status)
  }

  private svg(w: number, h: number, label: string, hue: string): Buffer {
    return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hue}"/><stop offset="1" stop-color="#1b1b2f"/></linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <circle cx="${w / 2}" cy="${h * 0.4}" r="${h * 0.16}" fill="#fff" fill-opacity="0.85"/>
      <rect x="${w / 2 - h * 0.22}" y="${h * 0.58}" width="${h * 0.44}" height="${h * 0.5}" rx="${h * 0.15}" fill="#fff" fill-opacity="0.85"/>
      <text x="${w * 0.04}" y="${h * 0.12}" font-size="${h * 0.07}" font-family="Helvetica, Arial" fill="#fff" font-weight="bold">${label}</text>
    </svg>`)
  }

  async capture(dir: string): Promise<string> {
    if (this.status.state !== 'ready') throw new Error('Camera not connected')
    this.setStatus({ state: 'busy' })
    try {
      if (this.size.w >= 3000) await new Promise((r) => setTimeout(r, 400)) // shutter + transfer latency
      if (this.failNext) {
        this.failNext = false
        throw new Error('Mock camera: simulated focus failure')
      }
      this.shots++
      await mkdir(dir, { recursive: true })
      const file = join(dir, `IMG_${String(this.shots).padStart(4, '0')}_${Date.now()}.jpg`)
      await sharp(this.svg(this.size.w, this.size.h, `MOCK SHOT ${this.shots}`, PALETTE[this.shots % PALETTE.length])).linear(this.gain(), 0).jpeg({ quality: 90 }).toFile(file)
      return file
    } finally {
      this.setStatus({ state: 'ready' })
    }
  }

  async startLiveView(): Promise<boolean> {
    return true
  }

  async getLiveViewFrame(): Promise<Buffer | null> {
    this.frame++
    return sharp(this.svg(960, 640, `LIVE ${new Date().toLocaleTimeString('en-GB')}`, PALETTE[Math.floor(this.frame / 10) % PALETTE.length])).linear(this.gain(), 0).jpeg({ quality: 60 }).toBuffer()
  }

  async stopLiveView(): Promise<void> {}

  /**
   * Fake exposure so test shots respond on a Mac: stops relative to ISO 400, f/5.6, 1/125.
   * With flash, shutter speed barely changes the subject's brightness, so it only counts a little.
   */
  private gain(): number {
    const e = this.exposure
    const iso = Number(e.iso) || 400
    const f = Number(e.aperture) || 5.6
    const t = shutterSeconds(e.shutter ?? '1/125') || 1 / 125
    return 2 ** (Math.log2(iso / 400) + 2 * Math.log2(5.6 / f) + 0.3 * Math.log2(t * 125))
  }

  async getExposure(): Promise<ExposureState> {
    if (this.status.state === 'disconnected') throw new Error('Camera not connected')
    const manual = this.mode === 'M'
    const options = manual ? structuredClone(MOCK_OPTIONS) : { iso: [], aperture: [], shutter: [], whiteBalance: [] }
    return { mode: this.mode, manual, current: { ...this.exposure }, options }
  }

  async setExposure(key: ExposureKey, value: string): Promise<ExposureState> {
    const { options } = await this.getExposure()
    if (!options[key].includes(value)) throw new Error(`${value} is not available on the camera right now.`)
    this.exposure = { ...this.exposure, [key]: value }
    return this.getExposure()
  }
}
