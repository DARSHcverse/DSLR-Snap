/**
 * Print packages: an event can stop printing after N prints (operators sell "200 prints, then
 * digital"). 0 means no limit. Counted in sheets the booth has queued for the event's sessions.
 */

/** How many of a session's copies still fit in the package. */
export function printsToMake(limit: number, used: number, copies: number): number {
  if (!limit) return copies
  return Math.max(0, Math.min(copies, limit - used))
}

/** 'near' in the last 10% (at least the last 5 prints), 'done' when used up. */
export function packageState(limit: number, used: number): 'ok' | 'near' | 'done' {
  if (!limit) return 'ok'
  const left = limit - used
  if (left <= 0) return 'done'
  return left <= Math.max(5, Math.ceil(limit * 0.1)) ? 'near' : 'ok'
}
