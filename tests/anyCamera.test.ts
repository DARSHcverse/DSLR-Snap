import { EventEmitter } from 'node:events'
import { describe, expect, it } from 'vitest'
import { AnyCamera } from '../src/main/camera/AnyCamera'
import { decodeLabelExposure, NIKON_CODEC } from '../src/main/camera/nikonCodec'
import type { CameraStatus } from '../src/shared/types'

/** A camera bridge stand-in whose "camera" can be plugged in or out. */
class FakeBrand extends EventEmitter {
  status: CameraStatus
  shots = 0
  constructor(readonly driver: CameraStatus['driver'], public plugged = false) {
    super()
    this.status = { driver, state: 'disconnected', liveViewSupported: true }
  }
  getStatus() {
    return this.status
  }
  set(state: CameraStatus['state'], model?: string) {
    this.status = { ...this.status, state, model }
    this.emit('status', this.status)
  }
  async connect() {
    if (!this.plugged) throw new Error('no camera')
    this.set('ready', this.driver === 'nikon' ? 'Nikon Z 50' : 'Canon EOS R100')
  }
  async disconnect() {
    this.set('disconnected')
  }
  async capture() {
    this.shots++
    return `/${this.driver}.jpg`
  }
  async startLiveView() {
    return true
  }
  async getLiveViewFrame() {
    return Buffer.from(this.driver)
  }
  async stopLiveView() {}
  async getExposure() {
    return { mode: 'M', manual: true, current: {}, options: { iso: [], aperture: [], shutter: [], whiteBalance: [] } }
  }
  async setExposure() {
    return this.getExposure()
  }
}

describe('automatic camera (Canon or Nikon)', () => {
  it('uses whichever brand is plugged in', async () => {
    const canon = new FakeBrand('canon-edsdk')
    const nikon = new FakeBrand('nikon', true)
    const cam = new AnyCamera([canon, nikon] as never)
    await cam.connect()
    expect(cam.getStatus()).toMatchObject({ state: 'ready', model: 'Nikon Z 50' })
    expect(cam.driver).toBe('nikon')
    expect(await cam.capture('/x')).toBe('/nikon.jpg')
    expect((await cam.getLiveViewFrame())?.toString()).toBe('nikon')
  })

  it('follows a swap from Nikon to Canon mid-event', async () => {
    const canon = new FakeBrand('canon-edsdk')
    const nikon = new FakeBrand('nikon', true)
    const cam = new AnyCamera([canon, nikon] as never)
    await cam.connect()
    nikon.set('disconnected')
    canon.plugged = true
    await canon.connect()
    expect(cam.getStatus().model).toBe('Canon EOS R100')
    expect(await cam.capture('/x')).toBe('/canon-edsdk.jpg')
  })

  it('says to connect a Canon or Nikon when neither is there', async () => {
    const cam = new AnyCamera([new FakeBrand('canon-edsdk'), new FakeBrand('nikon')] as never)
    await expect(cam.connect()).rejects.toThrow(/Canon or Nikon/)
    expect(cam.getStatus()).toMatchObject({ state: 'disconnected', message: expect.stringContaining('Canon or Nikon') })
    await expect(cam.capture('/x')).rejects.toThrow(/Canon or Nikon/)
    expect(await cam.startLiveView()).toBe(false)
  })
})

describe('Nikon exposure values', () => {
  const raw = {
    mode: 'M',
    manual: true,
    current: { iso: '400', aperture: '5.6', shutter: '1/125', whiteBalance: 'Flash' },
    options: { iso: ['100', '200', '400'], aperture: ['4', '5.6', '8'], shutter: ['1/60', '1/125', '1/200'], whiteBalance: ['Auto', 'Flash'] }
  }

  it('arrive as plain labels and are checked', () => {
    expect(decodeLabelExposure(raw)).toEqual(raw)
    expect(decodeLabelExposure({ options: { iso: ['100', 5, null] } })).toEqual({
      mode: '?', manual: false, current: {}, options: { iso: ['100'], aperture: [], shutter: [], whiteBalance: [] }
    })
  })

  it('are only sent when the camera offers them', () => {
    expect(NIKON_CODEC.encode('shutter', raw, '1/200')).toEqual({ key: 'shutter', value: '1/200' })
    expect(() => NIKON_CODEC.encode('shutter', raw, '1/4000')).toThrow(/doesn't offer/)
  })
})
