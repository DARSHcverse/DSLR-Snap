import { describe, expect, it } from 'vitest'
import { OutageWatch, Throttle } from '../src/shared/alerts'

describe('OutageWatch (camera lost while guests are using the booth)', () => {
  it('alerts once after a minute without the camera, and again only after it came back and dropped again', () => {
    const w = new OutageWatch(60_000)
    expect(w.update(false, 0)).toBe(false)
    expect(w.update(false, 59_000)).toBe(false)
    expect(w.update(false, 60_000)).toBe(true)
    expect(w.update(false, 300_000)).toBe(false)
    expect(w.update(true, 310_000)).toBe(false)
    expect(w.update(false, 320_000)).toBe(false)
    expect(w.update(false, 380_000)).toBe(true)
  })
  it('a short drop (camera reconnecting by itself) never alerts', () => {
    const w = new OutageWatch(60_000)
    w.update(false, 0)
    w.update(true, 20_000)
    expect(w.update(false, 70_000)).toBe(false)
  })
  it('forgets an outage when the booth stops being shown', () => {
    const w = new OutageWatch(60_000)
    w.update(false, 0)
    w.reset()
    expect(w.update(false, 30_000)).toBe(false)
    expect(w.update(false, 90_000)).toBe(true)
  })
})

describe('Throttle', () => {
  it('lets one through per window', () => {
    const t = new Throttle(15 * 60_000)
    expect(t.allow(0)).toBe(true)
    expect(t.allow(60_000)).toBe(false)
    expect(t.allow(15 * 60_000)).toBe(true)
  })
})
