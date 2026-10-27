import { EventEmitter } from 'node:events'
import type { CloudGallery } from '../cloud/CloudGallery'
import type { BoothDatabase } from '../db/database'

/** Exponential backoff capped at 15 minutes: 15s, 30s, 1m, 2m, 4m ... */
export function backoffMs(attempts: number): number {
  return Math.min(15 * 60_000, 15_000 * 2 ** Math.max(0, attempts - 1))
}

/**
 * Background uploader. Uploads never block capture or printing; if the venue has no
 * internet, sessions stay pending and go up when connectivity returns.
 */
export class UploadQueue extends EventEmitter {
  private timer?: NodeJS.Timeout
  private busy = false

  constructor(private db: BoothDatabase, private gallery: CloudGallery, private intervalMs = 10_000) {
    super()
    db.resetStuckUploads()
  }

  /** Runs even while the gallery is off: it can switch on later (e.g. the booth signs in). */
  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => void this.tick(), this.intervalMs)
    void this.tick()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
  }

  enqueue(sessionId: string, filePath: string): void {
    if (!this.gallery.enabled) return
    this.db.enqueueUpload(sessionId, filePath)
    void this.tick()
  }

  async tick(now = new Date()): Promise<void> {
    if (this.busy || !this.gallery.enabled) return
    this.busy = true
    try {
      for (const job of this.db.dueUploads(now)) {
        const session = this.db.getSession(job.sessionId)
        if (!session) continue
        this.db.updateUpload(job.id, { status: 'uploading' })
        try {
          const url = await this.gallery.upload(session.id, session.eventId, job.filePath)
          this.db.updateUpload(job.id, { status: 'done', url, incAttempts: true })
          this.db.updateSession(session.id, { galleryUrl: url })
          this.emit('uploaded', session.id, url)
        } catch (e) {
          const attempts = job.attempts + 1
          this.db.updateUpload(job.id, {
            status: 'failed',
            error: e instanceof Error ? e.message : String(e),
            nextAttemptAt: new Date(now.getTime() + backoffMs(attempts)),
            incAttempts: true
          })
        }
        this.emit('changed')
      }
    } finally {
      this.busy = false
    }
  }
}
