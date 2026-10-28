/**
 * App updates are downloaded quietly in the background and never interrupt an event: they install
 * when the operator closes DSLR Snap, or when they press "Restart to update" with nothing in flight.
 */

export type UpdateStatus =
  | { state: 'off' } // development builds, or no update server yet
  | { state: 'idle'; checkedAt: number | null }
  | { state: 'checking' }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'error'; message: string }

export const CHECK_EVERY_MS = 6 * 3_600_000

export function shouldCheckForUpdates(s: { packaged: boolean; lastCheck: number | null; now: number }): boolean {
  if (!s.packaged) return false
  return s.lastCheck === null || s.now - s.lastCheck >= CHECK_EVERY_MS
}

/** Why the update can't install right now, or null when it's safe to restart. */
export function installBlocker(s: { boothShowing: boolean; printsWaiting: number; recording: boolean }): string | null {
  if (s.boothShowing) return 'Leave the booth screen first.'
  if (s.recording) return 'Wait for the recording to finish.'
  if (s.printsWaiting > 0) return `Wait for ${s.printsWaiting} ${s.printsWaiting === 1 ? 'print' : 'prints'} to finish.`
  return null
}
