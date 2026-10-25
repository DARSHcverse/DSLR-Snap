import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'

export interface CloudGallery {
  readonly enabled: boolean
  /** Uploads a session's final image and returns a private, shareable URL. */
  upload(sessionId: string, eventId: string, filePath: string): Promise<string>
}

export class DisabledGallery implements CloudGallery {
  readonly enabled = false
  async upload(): Promise<string> {
    throw new Error('Cloud gallery is not configured')
  }
}

/**
 * Supabase Storage implementation: private bucket + long-lived signed URL, so links can't be
 * enumerated. Fine for the operator's own booths. Before selling to other operators, put a small
 * API in front (per-device tokens, licence checks) instead of shipping any storage key.
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
