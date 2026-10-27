import { timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { remotePage } from './remotePage'

export interface RemoteStatus {
  eventName: string | null
  paused: boolean
  camera: { state: string; detail?: string }
  printer: { state: string; detail?: string; waiting: number }
  paper: { remaining: number; capacity: number } | null
  guests: number
  prints: number
  failedJobs: { id: string; at: string; error?: string }[]
  recent: { id: string; at: string }[]
}

export type RemoteAction =
  | { action: 'pause' }
  | { action: 'resume' }
  | { action: 'retry'; jobId: string }
  | { action: 'reprint'; sessionId: string }

export interface RemoteDeps {
  status: () => Promise<RemoteStatus>
  act: (a: RemoteAction) => Promise<void>
  thumb: (sessionId: string) => Promise<Buffer | null>
}

const ID = /^[0-9a-f-]{36}$/i

/**
 * The operator's phone remote: a small page served on the venue network. Every request must carry
 * the secret key from the QR code (in the path), so nobody else on the Wi-Fi can use it.
 */
export class RemoteServer {
  private server?: Server

  constructor(private deps: RemoteDeps, private key: string) {}

  setKey(key: string): void {
    this.key = key
  }

  get port(): number | undefined {
    return (this.server?.address() as AddressInfo | null)?.port
  }

  async start(port: number, host = '0.0.0.0'): Promise<number> {
    if (this.server) return this.port!
    const server = createServer((req, res) => void this.handle(req, res))
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(port, host, () => resolve())
    })
    this.server = server
    return this.port!
  }

  async stop(): Promise<void> {
    const s = this.server
    this.server = undefined
    if (s) await new Promise<void>((r) => s.close(() => r()))
  }

  private keyMatches(given: string): boolean {
    const a = Buffer.from(given)
    const b = Buffer.from(this.key)
    return a.length === b.length && timingSafeEqual(a, b)
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const send = (status: number, body: string | Buffer, type = 'application/json') => {
      res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' })
      res.end(body)
    }
    try {
      const [, r, key, ...rest] = (req.url ?? '/').split('?')[0].split('/')
      if (r !== 'r' || !key || !this.keyMatches(key)) return send(404, 'Not found', 'text/plain')
      const route = rest.join('/')

      if (req.method === 'GET' && route === '') return send(200, remotePage(), 'text/html; charset=utf-8')
      if (req.method === 'GET' && route === 'status') return send(200, JSON.stringify(await this.deps.status()))
      if (req.method === 'GET' && route.startsWith('thumb/')) {
        const id = route.slice(6)
        const img = ID.test(id) ? await this.deps.thumb(id) : null
        return img ? send(200, img, 'image/jpeg') : send(404, 'Not found', 'text/plain')
      }
      if (req.method === 'POST' && route === 'action') {
        const action = parseAction(await readBody(req))
        if (!action) return send(400, JSON.stringify({ error: 'Bad action' }))
        await this.deps.act(action)
        return send(200, JSON.stringify({ ok: true }))
      }
      return send(404, 'Not found', 'text/plain')
    } catch (e) {
      return send(500, JSON.stringify({ error: e instanceof Error ? e.message : 'Error' }))
    }
  }
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  let raw = ''
  for await (const chunk of req) {
    raw += chunk
    if (raw.length > 4096) throw new Error('Too large')
  }
  return JSON.parse(raw || '{}')
}

export function parseAction(b: unknown): RemoteAction | null {
  const o = (b ?? {}) as Record<string, unknown>
  if (o.action === 'pause' || o.action === 'resume') return { action: o.action }
  if (o.action === 'retry' && typeof o.jobId === 'string' && ID.test(o.jobId)) return { action: 'retry', jobId: o.jobId }
  if (o.action === 'reprint' && typeof o.sessionId === 'string' && ID.test(o.sessionId)) return { action: 'reprint', sessionId: o.sessionId }
  return null
}
