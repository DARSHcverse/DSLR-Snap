import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

/**
 * Stands in for a GoPro's Open GoPro HTTP API (wired USB): the same paths and JSON shapes as the
 * real camera, so the 360 booth can be developed and tested without one. Used by tests and by
 * DSLR_SNAP_FAKE_GOPRO=1 in development; never in the installed app.
 */
export class FakeGoPro {
  private server?: Server
  wiredControl = false
  recording = false
  settings: Record<number, number> = {}
  presetGroup?: number
  files: { name: string; data: Buffer }[] = []
  /** Every request path, in order. */
  log: string[] = []
  /** Answer every request with this status (e.g. 500), to simulate a broken camera. */
  failWith?: number
  private recordStarted = 0

  /** `makeClip(seconds)` produces the MP4 the camera "recorded". */
  constructor(private makeClip: (seconds: number) => Promise<Buffer>) {}

  async start(port = 0): Promise<string> {
    this.server = createServer(async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://x')
      this.log.push(url.pathname + url.search)
      const json = (body: unknown, status = 200) => {
        res.writeHead(status, { 'content-type': 'application/json' })
        res.end(JSON.stringify(body))
      }
      if (this.failWith) return json({ error: 'fail' }, this.failWith)
      const p = url.pathname
      if (p === '/gopro/camera/control/wired_usb') {
        this.wiredControl = url.searchParams.get('p') === '1'
        return json({})
      }
      if (!this.wiredControl) return json({ error: 'wired control not enabled' }, 403)
      if (p === '/gopro/camera/keep_alive') return json({})
      if (p === '/gopro/camera/presets/set_group') {
        this.presetGroup = Number(url.searchParams.get('id'))
        return json({})
      }
      if (p === '/gopro/camera/setting') {
        this.settings[Number(url.searchParams.get('setting'))] = Number(url.searchParams.get('option'))
        return json({})
      }
      if (p === '/gopro/camera/shutter/start') {
        this.recording = true
        this.recordStarted = Date.now()
        return json({})
      }
      if (p === '/gopro/camera/shutter/stop') {
        if (this.recording) {
          this.recording = false
          const seconds = Math.max(1, Math.round((Date.now() - this.recordStarted) / 1000))
          this.files.push({ name: `GX01${String(this.files.length + 1).padStart(4, '0')}.MP4`, data: await this.makeClip(seconds) })
        }
        return json({})
      }
      if (p === '/gopro/media/list') {
        return json({ id: '1', media: [{ d: '100GOPRO', fs: this.files.map((f) => ({ n: f.name, cre: '0', mod: '0', s: String(f.data.length) })) }] })
      }
      const dl = /^\/videos\/DCIM\/100GOPRO\/(.+)$/.exec(p)
      const file = dl && this.files.find((f) => f.name === dl[1])
      if (file) {
        res.writeHead(200, { 'content-type': 'video/mp4', 'content-length': file.data.length })
        return res.end(file.data)
      }
      json({ error: 'not found' }, 404)
    })
    await new Promise<void>((r) => this.server!.listen(port, '127.0.0.1', () => r()))
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`
  }

  async stop(): Promise<void> {
    await new Promise<void>((r) => (this.server ? this.server.close(() => r()) : r()))
  }
}
