import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { BoothDatabase } from '../db/database'

const KEY = 'operator_pin'
const MAX_TRIES = 5
const LOCK_MS = 30_000

/**
 * Operator PIN that keeps guests out of the admin screens. Stored as a salted scrypt hash.
 * Wrong-attempt counting lives in memory: it only has to slow down a guest poking at the screen.
 */
export class PinLock {
  private failures = 0
  private lockedUntil = 0

  constructor(private db: BoothDatabase, private now: () => number = Date.now) {}

  hasPin(): boolean {
    return this.db.getSetting(KEY) !== undefined
  }

  verify(pin: string): { ok: boolean; lockedForSeconds?: number } {
    const stored = this.db.getSetting(KEY)
    if (!stored) return { ok: true }
    const wait = this.lockedUntil - this.now()
    if (wait > 0) return { ok: false, lockedForSeconds: Math.ceil(wait / 1000) }
    if (matches(stored, pin)) {
      this.failures = 0
      return { ok: true }
    }
    if (++this.failures >= MAX_TRIES) {
      this.failures = 0
      this.lockedUntil = this.now() + LOCK_MS
      return { ok: false, lockedForSeconds: LOCK_MS / 1000 }
    }
    return { ok: false }
  }

  /** Set, change (`next`) or remove (`next` = null) the PIN. Needs the current PIN once one exists. */
  setPin(current: string | null, next: string | null): void {
    const stored = this.db.getSetting(KEY)
    if (stored && !matches(stored, current ?? '')) throw new Error('The current PIN is wrong.')
    if (next === null) return this.db.setSetting(KEY, null)
    if (!/^\d{4,8}$/.test(next)) throw new Error('The PIN must be 4 to 8 digits.')
    const salt = randomBytes(16).toString('hex')
    this.db.setSetting(KEY, `${salt}:${scryptSync(next, salt, 32).toString('hex')}`)
  }
}

function matches(stored: string, pin: string): boolean {
  const [salt, hash] = stored.split(':')
  const expected = Buffer.from(hash, 'hex')
  return timingSafeEqual(scryptSync(pin, salt, expected.length), expected)
}
