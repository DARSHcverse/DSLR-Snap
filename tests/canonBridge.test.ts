import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CanonBridgeCamera } from '../src/main/camera/CanonBridgeCamera'

const fake = join(__dirname, 'fixtures', 'fake-bridge.mjs')
let cam: CanonBridgeCamera | undefined
const make = (...flags: string[]) => (cam = new CanonBridgeCamera(process.execPath, [fake, ...flags], { default: 2000, capture: 500 }))

afterEach(async () => {
  await cam?.disconnect()
  cam = undefined
})

describe('Canon bridge protocol', () => {
  it('connects, reports model and live view, captures', async () => {
    const c = make()
    await c.connect()
    expect(c.getStatus()).toMatchObject({ state: 'ready', model: 'Canon EOS R100', liveViewSupported: true })
    expect(await c.capture('/photos')).toBe('/photos/IMG_1.JPG')
    expect(c.getStatus().state).toBe('ready')
    expect((await c.getLiveViewFrame())?.toString()).toBe('frame')
  })

  it('surfaces "no camera" as an error status', async () => {
    const c = make('--no-camera')
    await expect(c.connect()).rejects.toThrow(/No Canon camera/)
    expect(c.getStatus()).toMatchObject({ state: 'error', message: 'No Canon camera found.' })
  })

  it('handles unsolicited disconnect events', async () => {
    const c = make()
    await c.connect()
    await c.capture('/p')
    const statuses: string[] = []
    c.on('status', (s) => statuses.push(s.state))
    await c.capture('/p')
    await new Promise((r) => setTimeout(r, 50))
    expect(c.getStatus().state).toBe('disconnected')
    await expect(c.capture('/p')).rejects.toThrow(/disconnected/i)
  })

  it('times out a capture that never returns', async () => {
    const c = make('--hang-capture')
    await c.connect()
    await expect(c.capture('/p')).rejects.toThrow(/did not respond/)
  })

  it('reads exposure as camera labels', async () => {
    const c = make()
    await c.connect()
    const s = await c.getExposure()
    expect(s).toMatchObject({ mode: 'M', manual: true, current: { iso: '400', aperture: '5.6', shutter: '1/125', whiteBalance: 'Auto' } })
    expect(s.options.shutter).toContain('1/500') // raw camera list; flash filtering happens in applyExposure/readExposure
  })

  it('sets exposure by label and emits "exposure" when the camera reports the change', async () => {
    const c = make()
    await c.connect()
    const changed = new Promise((r) => c.once('exposure', r))
    const s = await c.setExposure('aperture', '8')
    expect(s.current.aperture).toBe('8')
    await changed
    await expect(c.setExposure('iso', '6400')).rejects.toThrow(/not available/)
  })

  it('reports a non-M mode dial with nothing adjustable', async () => {
    const c = make('--auto-mode')
    await c.connect()
    const s = await c.getExposure()
    expect(s).toMatchObject({ mode: 'Auto', manual: false })
    expect(s.options.aperture).toEqual([])
  })

  it('rejects in-flight requests if the bridge crashes', async () => {
    const c = make('--crash-on-capture')
    await c.connect()
    await expect(c.capture('/p')).rejects.toThrow(/exited/)
    expect(c.getStatus().state).toBe('error')
  })
})
