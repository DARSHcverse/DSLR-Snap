import { describe, expect, it } from 'vitest'
import { installBlocker, shouldCheckForUpdates } from '../src/shared/updates'

const idle = { boothShowing: false, printsWaiting: 0, recording: false }

describe('when an update may install', () => {
  it('installs only from the operator screens with nothing in flight', () => {
    expect(installBlocker(idle)).toBeNull()
  })

  it('never while guests are on the booth screen', () => {
    expect(installBlocker({ ...idle, boothShowing: true })).toMatch(/booth screen/)
  })

  it('waits for prints in the queue', () => {
    expect(installBlocker({ ...idle, printsWaiting: 2 })).toMatch(/2 prints/)
    expect(installBlocker({ ...idle, printsWaiting: 1 })).toMatch(/1 print\b/)
  })

  it('waits for a 360 spin or video being recorded', () => {
    expect(installBlocker({ ...idle, recording: true })).toMatch(/recording/)
  })
})

describe('when to look for updates', () => {
  const HOUR = 3_600_000
  it('only in the installed app, and not more than every 6 hours', () => {
    expect(shouldCheckForUpdates({ packaged: false, lastCheck: 0, now: 10 * HOUR })).toBe(false)
    expect(shouldCheckForUpdates({ packaged: true, lastCheck: null, now: 0 })).toBe(true)
    expect(shouldCheckForUpdates({ packaged: true, lastCheck: 0, now: 5 * HOUR })).toBe(false)
    expect(shouldCheckForUpdates({ packaged: true, lastCheck: 0, now: 6 * HOUR })).toBe(true)
  })
})
