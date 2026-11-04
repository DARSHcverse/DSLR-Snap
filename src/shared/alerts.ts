/**
 * When the booth emails the operator about a problem (through the website, so it reaches their
 * phone). Kept small and pure so the rules are tested: alerts must be rare enough to trust.
 */

/** True once when something has been down for `after` ms; again only after it recovered and dropped again. */
export class OutageWatch {
  private since: number | null = null
  private alerted = false

  constructor(private after: number) {}

  update(ok: boolean, now: number): boolean {
    if (ok) {
      this.reset()
      return false
    }
    this.since ??= now
    if (!this.alerted && now - this.since >= this.after) {
      this.alerted = true
      return true
    }
    return false
  }

  reset(): void {
    this.since = null
    this.alerted = false
  }
}

/** At most one alert per window (a jammed printer fails every job; one email is enough). */
export class Throttle {
  private last = -Infinity

  constructor(private window: number) {}

  allow(now: number): boolean {
    if (now - this.last < this.window) return false
    this.last = now
    return true
  }
}

export const CAMERA_LOST_AFTER_MS = 60_000
export const PRINTER_ALERT_EVERY_MS = 15 * 60_000
