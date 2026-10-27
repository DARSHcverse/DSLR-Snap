import { describe, expect, it } from 'vitest'
import { isBlockedWhileLocked, shouldLock } from '../src/main/kiosk'

const key = (key: string, mods: Partial<{ alt: boolean; control: boolean; meta: boolean; shift: boolean }> = {}) => ({
  key, alt: false, control: false, meta: false, shift: false, ...mods
})

describe('kiosk lock', () => {
  it('locks only the installed app, only on the booth screen, only when turned on', () => {
    expect(shouldLock({ packaged: true, boothShowing: true, kioskLock: true })).toBe(true)
    expect(shouldLock({ packaged: false, boothShowing: true, kioskLock: true })).toBe(false)
    expect(shouldLock({ packaged: true, boothShowing: false, kioskLock: true })).toBe(false)
    expect(shouldLock({ packaged: true, boothShowing: true, kioskLock: false })).toBe(false)
  })

  it('blocks close, quit, reload and dev tools shortcuts', () => {
    for (const k of [key('F4', { alt: true }), key('w', { control: true }), key('Q', { control: true }), key('r', { meta: true }), key('F5'), key('F11'), key('I', { control: true, shift: true })]) {
      expect(isBlockedWhileLocked(k)).toBe(true)
    }
  })

  it('still lets the operator open their menu and guests type', () => {
    expect(isBlockedWhileLocked(key('A', { control: true, shift: true }))).toBe(false)
    expect(isBlockedWhileLocked(key('w'))).toBe(false)
    expect(isBlockedWhileLocked(key('Enter'))).toBe(false)
  })
})
