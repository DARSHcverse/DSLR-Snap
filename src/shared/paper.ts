import type { PaperState } from './types'

/** Prints left when the operator's phone gets a heads-up, most relaxed first. */
export const PAPER_ALERTS = [50, 15] as const

/**
 * Which low-paper warning to send now, if any. `sent` holds the thresholds already warned about for
 * this roll. A threshold only counts when the roll is bigger than it, and when several were passed
 * at once (a burst of prints while offline), only the most urgent is sent; `covers` marks them all.
 */
export function paperAlertDue(paper: PaperState | null, sent: readonly number[]): { threshold: number; covers: number[] } | null {
  if (!paper) return null
  const passed = PAPER_ALERTS.filter((t) => paper.capacity > t && paper.remaining <= t && !sent.includes(t))
  if (!passed.length) return null
  return { threshold: Math.min(...passed), covers: [...passed] }
}
