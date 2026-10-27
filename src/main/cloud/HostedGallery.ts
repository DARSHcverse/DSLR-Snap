import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { colourPathFor, gifPathFor } from '../sessionFiles'
import type { CloudGallery } from './CloudGallery'

export type GalleryFileKind = 'photo' | 'colour' | 'gif'

export interface HostedGalleryDeps {
  /** e.g. https://dslrsnap.com */
  accountUrl: string
  /** The booth's sign-in; null when signed out. */
  credentials: () => { refreshToken: string; machine: string } | null
  /** Uploads only run while the booth is licensed (the website refuses them otherwise anyway). */
  allowed: () => boolean
  event: (eventId: string) => { name: string; date: string } | undefined
  fetch?: typeof fetch
}

/**
 * dslrsnap.com's gallery. The booth never holds a storage key: for each session it asks the website
 * (with its device sign-in) for one-time upload links, PUTs the files, then marks the session ready.
 * The guest page link is known before uploading, so the QR shows instantly, even offline.
 */
export class HostedGallery implements CloudGallery {
  constructor(private deps: HostedGalleryDeps) {}

  get enabled(): boolean {
    return this.deps.allowed() && !!this.deps.credentials()
  }

  sessionUrl(sessionId: string): string {
    return `${this.deps.accountUrl}/s/${sessionId}`
  }

  async upload(sessionId: string, eventId: string, filePath: string): Promise<string> {
    const event = this.deps.event(eventId)
    if (!event) throw new Error('Event not found')
    const files: { kind: GalleryFileKind; path: string; contentType: string }[] = [{ kind: 'photo', path: filePath, contentType: 'image/jpeg' }]
    if (existsSync(colourPathFor(filePath))) files.push({ kind: 'colour', path: colourPathFor(filePath), contentType: 'image/jpeg' })
    if (existsSync(gifPathFor(filePath))) files.push({ kind: 'gif', path: gifPathFor(filePath), contentType: 'image/gif' })
    const bodies = await Promise.all(files.map((f) => readFile(f.path)))

    const { uploads, pageUrl } = await this.post<{ uploads: { kind: GalleryFileKind; url: string; headers?: Record<string, string> }[]; pageUrl: string }>('/api/app/uploads', {
      sessionId,
      event: { id: eventId, name: event.name, date: event.date },
      files: files.map((f, i) => ({ kind: f.kind, contentType: f.contentType, bytes: bodies[i].length }))
    })
    for (const up of uploads) {
      const i = files.findIndex((f) => f.kind === up.kind)
      if (i < 0) continue
      const res = await (this.deps.fetch ?? fetch)(up.url, {
        method: 'PUT',
        headers: { ...up.headers, 'content-type': files[i].contentType, 'x-upsert': 'true' },
        body: new Uint8Array(bodies[i]),
        signal: AbortSignal.timeout(120_000)
      })
      if (!res.ok) throw new Error(`Upload of ${up.kind} failed (${res.status})`)
    }
    await this.post('/api/app/uploads/complete', { sessionId })
    return pageUrl
  }

  /** The host's page with every photo of the event (shareable link, created on first request). */
  async eventLink(eventId: string): Promise<string> {
    const event = this.deps.event(eventId)
    if (!event) throw new Error('Event not found')
    return (await this.post<{ url: string }>('/api/app/event-link', { event: { id: eventId, name: event.name, date: event.date } })).url
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const creds = this.deps.credentials()
    if (!creds) throw new Error('Sign in under Account to use the cloud gallery.')
    const res = await (this.deps.fetch ?? fetch)(`${this.deps.accountUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...creds, ...body }),
      signal: AbortSignal.timeout(20_000)
    })
    const json = (await res.json().catch(() => ({}))) as { message?: string }
    if (!res.ok) throw new Error(json.message ?? `The website returned ${res.status}.`)
    return json as T
  }
}
