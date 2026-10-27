import { EventEmitter } from 'node:events'
import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { networkInterfaces } from 'node:os'
import { dirname } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

/**
 * GoPro HERO9–12 over USB, using GoPro's Open GoPro HTTP API. Plugged in by USB, the camera is a
 * small network: the laptop gets 172.2X.1YZ.<n> and the camera answers on 172.2X.1YZ.51:8080
 * (X, Y, Z = last three digits of its serial). Found automatically; no app or pairing needed.
 */
export type GoProState = 'disconnected' | 'connecting' | 'ready' | 'recording' | 'error'

export interface GoProStatus {
  state: GoProState
  address?: string
  message?: string
}

/** 172.2X.1YZ.n on this computer → the camera's base URL (…51:8080). */
export function findWiredGoPro(interfaces = networkInterfaces()): string | null {
  for (const list of Object.values(interfaces)) {
    for (const a of list ?? []) {
      const m = a.family === 'IPv4' && /^172\.2(\d)\.1(\d)(\d)\.\d+$/.exec(a.address)
      if (m) return `http://172.2${m[1]}.1${m[2]}${m[3]}.51:8080`
    }
  }
  return null
}

export interface MediaFile {
  folder: string
  name: string
}

/** Every file in a /gopro/media/list response, oldest first by name (GoPro numbers files in order). */
export function mediaFiles(list: unknown): MediaFile[] {
  const media = (list as { media?: { d?: string; fs?: { n?: string }[] }[] })?.media ?? []
  return media.flatMap((dir) => (dir.fs ?? []).filter((f) => f.n).map((f) => ({ folder: dir.d ?? '', name: f.n! })))
}

export const FPS_OPTION = { 120: 1, 240: 0 } as const
export const RESOLUTION_OPTION = { '1080': 9, '2.7K': 4, '4K': 1 } as const
const VIDEO_PRESET_GROUP = 1000
const KEEP_ALIVE_MS = 3000
const SCAN_MS = 3000

export interface GoProDeps {
  /** Where to look for the camera (default: this computer's USB network interfaces). */
  discover?: () => string | null
  fetch?: typeof fetch
}

/**
 * Finds the camera when it's plugged in, takes control, keeps it awake, and records clips.
 * Emits 'status' whenever the state changes (for the operator screens).
 */
export class GoPro extends EventEmitter {
  private status: GoProStatus = { state: 'disconnected' }
  private base: string | null = null
  private timer?: NodeJS.Timeout
  private lastAlive = 0

  constructor(private deps: GoProDeps = {}) {
    super()
  }

  getStatus(): GoProStatus {
    return this.status
  }

  private set(p: GoProStatus): void {
    if (p.state === this.status.state && p.message === this.status.message && p.address === this.status.address) return
    this.status = p
    this.emit('status', p)
  }

  private async get(path: string, timeoutMs = 5000): Promise<Response> {
    if (!this.base) throw new Error('No GoPro connected')
    const res = await (this.deps.fetch ?? fetch)(`${this.base}/${path}`, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) throw new Error(`GoPro answered ${res.status} to ${path.split('?')[0]}`)
    return res
  }

  /** Looks for a camera every few seconds and keeps a connected one awake. */
  start(): void {
    void this.tick()
    this.timer = setInterval(() => void this.tick(), SCAN_MS)
  }

  stop(): void {
    clearInterval(this.timer)
  }

  async tick(): Promise<void> {
    const found = (this.deps.discover ?? findWiredGoPro)()
    if (!found) {
      this.base = null
      return this.set({ state: 'disconnected', message: 'Connect a GoPro (HERO9–12) by USB and switch it on.' })
    }
    if (found !== this.base || this.status.state === 'disconnected' || this.status.state === 'error') {
      this.base = found
      this.set({ state: 'connecting', address: found })
      try {
        await this.get('gopro/camera/control/wired_usb?p=1') // take control from the camera's buttons
        this.lastAlive = Date.now()
        this.set({ state: 'ready', address: found })
      } catch (e) {
        this.set({ state: 'error', address: found, message: `GoPro found but not answering: ${e instanceof Error ? e.message : e}` })
      }
      return
    }
    if (this.status.state === 'ready' && Date.now() - this.lastAlive >= KEEP_ALIVE_MS) {
      try {
        await this.get('gopro/camera/keep_alive', 3000)
        this.lastAlive = Date.now()
      } catch {
        this.set({ state: 'error', address: found, message: 'Lost the GoPro. Check the USB cable and battery.' })
      }
    }
  }

  /** Video preset group, then frame rate and resolution. Older firmware may refuse a combination; that's reported. */
  async configure(opts: { fps: 120 | 240; resolution: keyof typeof RESOLUTION_OPTION }): Promise<void> {
    await this.get(`gopro/camera/presets/set_group?id=${VIDEO_PRESET_GROUP}`)
    await this.get(`gopro/camera/setting?setting=2&option=${RESOLUTION_OPTION[opts.resolution]}`)
    await this.get(`gopro/camera/setting?setting=3&option=${FPS_OPTION[opts.fps]}`)
  }

  /**
   * Records for `seconds`, then downloads the new clip to `out`. The clip is whichever file
   * appears in the media list that wasn't there before recording.
   */
  async record(seconds: number, out: string, opts: { sleep?: (ms: number) => Promise<void> } = {}): Promise<string> {
    const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
    if (this.status.state !== 'ready') throw new Error(this.status.message ?? 'The GoPro is not ready.')
    const before = new Set(mediaFiles(await (await this.get('gopro/media/list')).json()).map((f) => `${f.folder}/${f.name}`))
    this.set({ ...this.status, state: 'recording' })
    try {
      await this.get('gopro/camera/shutter/start')
      await sleep(seconds * 1000)
      await this.get('gopro/camera/shutter/stop')
      // The camera needs a moment to finish writing the file.
      let clip: MediaFile | undefined
      for (let i = 0; i < 40 && !clip; i++) {
        await sleep(500)
        clip = mediaFiles(await (await this.get('gopro/media/list')).json()).find((f) => !before.has(`${f.folder}/${f.name}`) && /\.mp4$/i.test(f.name))
      }
      if (!clip) throw new Error("The GoPro didn't save a clip. Is there a memory card with space?")
      await mkdir(dirname(out), { recursive: true })
      const res = await this.get(`videos/DCIM/${clip.folder}/${clip.name}`, 300_000)
      await pipeline(Readable.fromWeb(res.body as never), createWriteStream(out))
      return out
    } finally {
      this.set({ ...this.status, state: 'ready' })
      this.lastAlive = Date.now()
    }
  }
}
