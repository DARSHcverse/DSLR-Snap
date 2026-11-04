export interface PendingEmail {
  id: string
  sessionId: string
  email: string
  eventName: string
}

export interface GuestMailerDeps {
  pending: () => PendingEmail[]
  markSent: (id: string) => void
  markFailed: (id: string, error: string) => void
  /** AccountService.call: null when signed out (they wait until it signs in again). */
  call: <T>(path: string, body?: Record<string, unknown>) => Promise<T | null>
  log?: (level: 'warn', m: string) => void
}

/**
 * Sends the "your photos" emails guests asked for, through the website. Offline (or signed out),
 * they wait and go on the next flush, like photo uploads; the website sends each one only once.
 */
export class GuestMailer {
  private running: Promise<void> | null = null

  constructor(private deps: GuestMailerDeps) {}

  flush(): Promise<void> {
    this.running ??= this.run().finally(() => (this.running = null))
    return this.running
  }

  private async run(): Promise<void> {
    for (const row of this.deps.pending()) {
      try {
        const res = await this.deps.call('/api/app/email-photos', { sessionId: row.sessionId, email: row.email, event: row.eventName })
        if (!res) return // signed out: try again later
        this.deps.markSent(row.id)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        this.deps.markFailed(row.id, msg)
        this.deps.log?.('warn', `guest email: ${msg}`)
        return // probably offline: stop, the next flush tries again
      }
    }
  }
}
