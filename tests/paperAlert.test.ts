import { describe, expect, it } from 'vitest'
import { paperAlertDue } from '../src/shared/paper'

const roll = (remaining: number, capacity = 400) => ({ capacity, used: capacity - remaining, remaining, loadedAt: '2026-11-03T10:00:00Z' })

describe('paperAlertDue', () => {
  it('nothing while there is plenty left, or no roll recorded', () => {
    expect(paperAlertDue(roll(200), [])).toBeNull()
    expect(paperAlertDue(null, [])).toBeNull()
  })
  it('warns at 50 left, then at 15, once each', () => {
    expect(paperAlertDue(roll(50), [])).toEqual({ threshold: 50, covers: [50] })
    expect(paperAlertDue(roll(40), [50])).toBeNull()
    expect(paperAlertDue(roll(15), [50])).toEqual({ threshold: 15, covers: [15] })
    expect(paperAlertDue(roll(3), [50, 15])).toBeNull()
  })
  it('sends only the most urgent one when both were passed at once', () => {
    expect(paperAlertDue(roll(10), [])).toEqual({ threshold: 15, covers: [50, 15] })
  })
  it('skips thresholds bigger than a small roll', () => {
    expect(paperAlertDue(roll(40, 40), [])).toBeNull()
    expect(paperAlertDue(roll(14, 40), [])).toEqual({ threshold: 15, covers: [15] })
  })
})
