import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatEventDate, todayIso } from '../src/shared/dates'

afterEach(() => vi.useRealTimers())

describe('dates', () => {
  it('uses the local calendar day, not UTC (east of UTC, early morning is still yesterday in UTC)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 25, 0, 30)) // 25 Oct 00:30 local time
    expect(todayIso()).toBe('2026-10-25')
  })

  it('formats an event date as that calendar day in any time zone', () => {
    expect(formatEventDate('2026-11-14', { day: 'numeric', month: 'short', year: 'numeric' })).toBe('14 Nov 2026')
  })
})
