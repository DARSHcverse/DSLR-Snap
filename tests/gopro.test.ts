import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { FakeGoPro } from '../src/main/gopro/FakeGoPro'
import { findWiredGoPro, GoPro, mediaFiles } from '../src/main/gopro/GoPro'

const iface = (address: string) => ({ address, family: 'IPv4', internal: false, netmask: '', mac: '', cidr: null }) as never

describe('finding a GoPro on USB', () => {
  it("works out the camera address from the laptop's USB network address", () => {
    expect(findWiredGoPro({ en7: [iface('172.24.106.55')] })).toBe('http://172.24.106.51:8080')
    expect(findWiredGoPro({ eth0: [iface('192.168.1.4')], usb: [iface('172.29.157.53')] })).toBe('http://172.29.157.51:8080')
  })

  it('ignores ordinary networks', () => {
    expect(findWiredGoPro({ wifi: [iface('192.168.1.4')], vpn: [iface('172.16.0.2')], docker: [iface('172.17.0.1')] })).toBeNull()
  })

  it('reads the media list format', () => {
    expect(mediaFiles({ media: [{ d: '100GOPRO', fs: [{ n: 'GX010001.MP4' }, { n: 'GOPR0002.JPG' }] }] })).toEqual([
      { folder: '100GOPRO', name: 'GX010001.MP4' },
      { folder: '100GOPRO', name: 'GOPR0002.JPG' }
    ])
    expect(mediaFiles({})).toEqual([])
  })
})

describe('GoPro control (against a fake camera with the Open GoPro API)', () => {
  let fake: FakeGoPro | undefined
  afterEach(async () => {
    await fake?.stop()
    fake = undefined
  })

  async function connect() {
    fake = new FakeGoPro(async (seconds) => Buffer.from(`clip of ${seconds}s`))
    const base = await fake.start()
    let plugged = true
    const gopro = new GoPro({ discover: () => (plugged ? base : null) })
    const states: string[] = []
    gopro.on('status', (s) => states.push(s.state))
    await gopro.tick()
    return { gopro, states, unplug: () => (plugged = false), plug: () => (plugged = true) }
  }

  it('connects by itself when plugged in, taking control over USB', async () => {
    const { gopro, states } = await connect()
    expect(gopro.getStatus().state).toBe('ready')
    expect(states).toEqual(['connecting', 'ready'])
    expect(fake!.wiredControl).toBe(true)
  })

  it('notices unplugging and reconnects when plugged back in', async () => {
    const { gopro, unplug, plug } = await connect()
    unplug()
    await gopro.tick()
    expect(gopro.getStatus()).toMatchObject({ state: 'disconnected', message: expect.stringContaining('Connect a GoPro') })
    plug()
    await gopro.tick()
    expect(gopro.getStatus().state).toBe('ready')
  })

  it('reports a camera that is found but not answering', async () => {
    fake = new FakeGoPro(async () => Buffer.alloc(0))
    fake.failWith = 500
    const base = await fake.start()
    const gopro = new GoPro({ discover: () => base })
    await gopro.tick()
    expect(gopro.getStatus()).toMatchObject({ state: 'error', message: expect.stringContaining('not answering') })
  })

  it('sets video mode, 240 fps and 2.7K', async () => {
    const { gopro } = await connect()
    await gopro.configure({ fps: 240, resolution: '2.7K' })
    expect(fake!.presetGroup).toBe(1000)
    expect(fake!.settings).toEqual({ 2: 4, 3: 0 })
  })

  it('records, waits for the file, and downloads only the new clip', async () => {
    const { gopro, states } = await connect()
    fake!.files.push({ name: 'GX010001.MP4', data: Buffer.from('old clip from yesterday') })
    const out = join(mkdtempSync(join(tmpdir(), 'gp-')), 'clip.mp4')
    await gopro.record(2, out, { sleep: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 1100))) })
    expect(readFileSync(out, 'utf8')).toMatch(/^clip of \ds$/)
    expect(fake!.log.filter((p) => p.includes('shutter'))).toEqual(['/gopro/camera/shutter/start', '/gopro/camera/shutter/stop'])
    expect(states).toContain('recording')
    expect(gopro.getStatus().state).toBe('ready')
  })

  it('refuses to record when no camera is connected', async () => {
    const { gopro, unplug } = await connect()
    unplug()
    await gopro.tick()
    await expect(gopro.record(1, '/tmp/x.mp4')).rejects.toThrow(/Connect a GoPro/)
  })
})
