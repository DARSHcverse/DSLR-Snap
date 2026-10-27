import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'

export interface CloudGallery {
  readonly enabled: boolean
  /** Uploads a session's final image and returns a private, shareable URL. */
  upload(sessionId: string, eventId: string, filePath: string): Promise<string>
  /**
   * The session's gallery page, if it is known before upload (hosted gallery: built from the random
   * session ID). Lets the booth show the QR instantly, even offline; the page waits for the photo.
   * Backends without it (signed storage URLs) only get a QR once the upload has finished.
   */
  sessionUrl?(sessionId: string, eventId: string): string
}

export class DisabledGallery implements CloudGallery {
  readonly enabled = false
  async upload(): Promise<string> {
    throw new Error('Cloud gallery is not configured')
  }
}

/**
 * Developer override: uploads straight to Supabase Storage with a service key from .env. Never ship
 * this to customers; the product uses HostedGallery (dslrsnap.com checks sign-in and plan).
 */
export class SupabaseGallery implements CloudGallery {
  readonly enabled = true

  constructor(private cfg: { url: string; key: string; bucket: string; linkDays: number }) {}

  async upload(sessionId: string, eventId: string, filePath: string): Promise<string> {
    const { createClient } = await import('@supabase/supabase-js')
    const client = createClient(this.cfg.url, this.cfg.key, { auth: { persistSession: false } })
    const objectPath = `${eventId}/${sessionId}/${basename(filePath)}`
    const body = await readFile(filePath)
    const up = await client.storage.from(this.cfg.bucket).upload(objectPath, body, { contentType: 'image/jpeg', upsert: true })
    if (up.error) throw new Error(`Upload failed: ${up.error.message}`)
    const signed = await client.storage.from(this.cfg.bucket).createSignedUrl(objectPath, this.cfg.linkDays * 86400, { download: false })
    if (signed.error || !signed.data) throw new Error(`Could not create link: ${signed.error?.message}`)
    return signed.data.signedUrl
  }
}

export function galleryFromEnv(env: NodeJS.ProcessEnv): CloudGallery {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return new DisabledGallery()
  return new SupabaseGallery({
    url: env.SUPABASE_URL,
    key: env.SUPABASE_SERVICE_KEY,
    bucket: env.SUPABASE_BUCKET || 'booth-sessions',
    linkDays: Number(env.GALLERY_LINK_DAYS) || 30
  })
}
