import { describe, expect, it } from 'vitest'
import { BoothDatabase } from '../src/main/db/database'
import { PinLock } from '../src/main/security/PinLock'

const make = () => {
  let now = 1_000_000
  const lock = new PinLock(new BoothDatabase(':memory:'), () => now)
  return { lock, advance: (ms: number) => (now += ms) }
}

describe('PinLock', () => {
  it('lets anyone in when no PIN is set', () => {
    const { lock } = make()
    expect(lock.hasPin()).toBe(false)
    expect(lock.verify('')).toEqual({ ok: true })
  })

  it('stores a hash, never the PIN itself, and verifies it', () => {
    const db = new BoothDatabase(':memory:')
    const lock = new PinLock(db)
    lock.setPin(null, '2468')
    expect(lock.hasPin()).toBe(true)
    expect(JSON.stringify(db.db.prepare('SELECT * FROM settings').all())).not.toContain('2468')
    expect(lock.verify('2468')).toEqual({ ok: true })
    expect(lock.verify('1111').ok).toBe(false)
  })

  it('only accepts 4 to 8 digits', () => {
    const { lock } = make()
    for (const bad of ['123', '12a4', '123456789', '']) expect(() => lock.setPin(null, bad)).toThrow(/4 to 8 digits/)
  })

  it('needs the current PIN to change or remove it', () => {
    const { lock } = make()
    lock.setPin(null, '2468')
    expect(() => lock.setPin('0000', '1357')).toThrow(/current PIN/)
    lock.setPin('2468', '1357')
    expect(lock.verify('1357').ok).toBe(true)
    lock.setPin('1357', null)
    expect(lock.hasPin()).toBe(false)
  })

  it('locks for 30 seconds after 5 wrong tries, even for the right PIN', () => {
    const { lock, advance } = make()
    lock.setPin(null, '2468')
    for (let i = 0; i < 4; i++) expect(lock.verify('0000')).toEqual({ ok: false })
    expect(lock.verify('0000')).toEqual({ ok: false, lockedForSeconds: 30 })
    expect(lock.verify('2468')).toEqual({ ok: false, lockedForSeconds: 30 })
    advance(31_000)
    expect(lock.verify('2468')).toEqual({ ok: true })
    // A success resets the counter.
    for (let i = 0; i < 4; i++) lock.verify('0000')
    expect(lock.verify('2468').ok).toBe(true)
  })
})
