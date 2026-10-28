import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { createInterface } from 'node:readline'
import type { CameraStatus, ExposureKey, ExposureState } from '../../shared/types'
import type { CameraAdapter } from './CameraAdapter'
import { BRIDGE_PROP, decodeExposure, encodeOption, type RawExposure } from './canonCodes'

/**
 * How a bridge reports exposure. Canon's sends raw EDSDK codes the app decodes (canonCodes.ts);
 * the Nikon bridge decodes Nikon's values itself and sends plain labels ("1/125", "5.6", "400").
 */
export interface ExposureCodec {
  driver: CameraStatus['driver']
  decode(raw: unknown): ExposureState
  /** Arguments for the bridge's set_exposure, given the latest raw get_exposure answer. */
  encode(key: ExposureKey, raw: unknown, value: string): Record<string, unknown>
}

export const CANON_CODEC: ExposureCodec = {
  driver: 'canon-edsdk',
  decode: (raw) => decodeExposure(raw as RawExposure),
  encode: (key, raw, value) => {
    const prop = BRIDGE_PROP[key]
    return { prop, code: encodeOption(key, (raw as RawExposure)[prop].allowed, value) }
  }
}

/**
 * Talks to a camera bridge (a small .NET program wrapping a camera maker's SDK: native/CanonBridge,
 * native/NikonBridge) over stdin/stdout. Both bridges speak the same protocol.
 *
 * Protocol: one JSON object per line.
 *   → {"id":1,"cmd":"capture","args":{"dir":"C:\\..."}}
 *   ← {"id":1,"ok":true,"data":{"path":"C:\\...\\IMG_0001.JPG"}}
 *   ← {"id":1,"ok":false,"error":"Camera busy"}
 *   ← {"event":"disconnected"}                 (unsolicited)
 *   ← {"event":"exposure_changed"}             (unsolicited: dial turned, lens zoomed, or our own set)
 *
 * Running the SDK out-of-process means a Canon SDK crash can't take the booth UI down;
 * we simply restart the bridge and reconnect.
 */
export class BridgeCamera extends EventEmitter implements CameraAdapter {
  readonly driver: CameraStatus['driver']
  private proc?: ChildProcessWithoutNullStreams
  private nextId = 1
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>()
  private status: CameraStatus
  private wantConnected = false
  private reconnectTimer?: NodeJS.Timeout

  constructor(
    private exePath: string,
    private args: string[] = [],
    private timeouts = { default: 10_000, capture: 20_000 },
    private codec: ExposureCodec = CANON_CODEC
  ) {
    super()
    this.driver = codec.driver
    this.status = { driver: codec.driver, state: 'disconnected', liveViewSupported: false }
  }

  getStatus(): CameraStatus {
    return this.status
  }

  private setStatus(p: Partial<CameraStatus>): void {
    this.status = { ...this.status, ...p }
    this.emit('status', this.status)
  }

  private ensureProcess(): ChildProcessWithoutNullStreams {
    if (this.proc && this.proc.exitCode === null) return this.proc
    const proc = spawn(this.exePath, this.args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
    this.proc = proc
    createInterface({ input: proc.stdout }).on('line', (line) => this.onLine(line))
    proc.stderr.on('data', (d) => this.emit('log', String(d)))
    proc.on('error', (err) => this.onExit(`Could not start camera bridge: ${err.message}`))
    proc.on('exit', (code) => this.onExit(`Camera bridge exited (code ${code})`))
    return proc
  }

  private onExit(message: string): void {
    this.proc = undefined
    for (const [, p] of this.pending) {
      clearTimeout(p.timer)
      p.reject(new Error(message))
    }
    this.pending.clear()
    this.setStatus(this.wantConnected ? { state: 'error', message } : { state: 'disconnected', message: undefined })
    this.scheduleReconnect()
  }

  private onLine(line: string): void {
    let msg: any
    try {
      msg = JSON.parse(line)
    } catch {
      this.emit('log', `bridge: ${line}`)
      return
    }
    if (msg.event) {
      if (msg.event === 'disconnected') {
        this.setStatus({ state: 'disconnected', message: 'Camera disconnected — check USB cable and power' })
        this.scheduleReconnect()
      }
      if (msg.event === 'exposure_changed') this.emit('exposure')
      this.emit('bridgeEvent', msg)
      return
    }
    const p = this.pending.get(msg.id)
    if (!p) return
    this.pending.delete(msg.id)
    clearTimeout(p.timer)
    msg.ok ? p.resolve(msg.data) : p.reject(new Error(msg.error || 'Camera error'))
  }

  private send<T = any>(cmd: string, args: Record<string, unknown> = {}, timeoutMs = this.timeouts.default): Promise<T> {
    const proc = this.ensureProcess()
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Camera did not respond to "${cmd}" within ${timeoutMs / 1000}s`))
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      proc.stdin.write(JSON.stringify({ id, cmd, args }) + '\n')
    })
  }

  private scheduleReconnect(): void {
    if (!this.wantConnected || this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined
      this.connect().catch(() => this.scheduleReconnect())
    }, 3000)
  }

  async connect(): Promise<void> {
    this.wantConnected = true
    this.setStatus({ state: 'connecting', message: undefined })
    try {
      const info = await this.send<{ model: string; liveView: boolean }>('connect')
      this.setStatus({ state: 'ready', model: info.model, liveViewSupported: !!info.liveView })
    } catch (e) {
      this.setStatus({ state: 'error', message: e instanceof Error ? e.message : String(e) })
      this.scheduleReconnect()
      throw e
    }
  }

  async disconnect(): Promise<void> {
    this.wantConnected = false
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = undefined
    if (this.proc) {
      await this.send('disconnect').catch(() => undefined)
      this.proc.kill()
    }
    this.setStatus({ state: 'disconnected' })
  }

  async capture(dir: string): Promise<string> {
    if (this.status.state !== 'ready') throw new Error(this.status.message || 'Camera not ready')
    this.setStatus({ state: 'busy' })
    try {
      const res = await this.send<{ path: string }>('capture', { dir }, this.timeouts.capture)
      return res.path
    } finally {
      if (this.getStatus().state === 'busy') this.setStatus({ state: 'ready' }) // don't overwrite a disconnect that happened mid-capture
    }
  }

  async startLiveView(): Promise<boolean> {
    if (!this.status.liveViewSupported) return false
    try {
      await this.send('liveview_start')
      return true
    } catch {
      return false
    }
  }

  async getLiveViewFrame(): Promise<Buffer | null> {
    try {
      const res = await this.send<{ jpeg: string | null }>('liveview_frame', {}, 2000)
      return res.jpeg ? Buffer.from(res.jpeg, 'base64') : null
    } catch {
      return null
    }
  }

  async stopLiveView(): Promise<void> {
    await this.send('liveview_stop').catch(() => undefined)
  }

  async getExposure(): Promise<ExposureState> {
    return this.codec.decode(await this.send('get_exposure'))
  }

  async setExposure(key: ExposureKey, value: string): Promise<ExposureState> {
    // Re-read what's allowed: it changes with the mode dial and the lens zoom.
    const raw = await this.send('get_exposure')
    return this.codec.decode(await this.send('set_exposure', this.codec.encode(key, raw, value)))
  }
}

/** Canon EOS over USB (native/CanonBridge). */
export class CanonBridgeCamera extends BridgeCamera {
  constructor(exePath: string, args: string[] = [], timeouts = { default: 10_000, capture: 20_000 }) {
    super(exePath, args, timeouts, CANON_CODEC)
  }
}
