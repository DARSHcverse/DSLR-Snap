import { describe, expect, it } from 'vitest'
import { boothReducer, retakesLeft, type BoothAction, type BoothConfig, type BoothState } from '../src/shared/sessionMachine'

const cfg: BoothConfig = { photosPerSession: 3, firstCountdownSeconds: 3, intervalSeconds: 2, reviewSeconds: 2, retakesAllowed: 1 }
const run = (actions: BoothAction[], start: BoothState = { name: 'welcome' }, c = cfg) => actions.reduce((s, a) => boothReducer(s, a, c), start)
const ticks = (n: number): BoothAction[] => Array.from({ length: n }, () => ({ type: 'TICK' }))
/** Countdown of `n` seconds, then the camera returns `path`. */
const shoot = (n: number, path: string): BoothAction[] => [...ticks(n), { type: 'CAPTURED', path }]

describe('booth session flow', () => {
  it('uses the first-photo countdown, then the shorter interval for later photos', () => {
    let s = run([{ type: 'START' }])
    expect(s).toMatchObject({ name: 'countdown', shot: 0, remaining: 3 })
    s = run(ticks(3), s)
    expect(s.name).toBe('capturing')
    s = run([{ type: 'CAPTURED', path: 'a' }], s)
    expect(s).toMatchObject({ name: 'preview', shot: 0, remaining: 2, photos: ['a'] })
    s = run(ticks(2), s)
    expect(s).toMatchObject({ name: 'countdown', shot: 1, remaining: 2, photos: ['a'] })
  })

  it('shows each photo, then goes straight to finishing after the last one (no end review)', () => {
    const s = run([{ type: 'START' }, ...shoot(3, 'a'), ...ticks(2), ...shoot(2, 'b'), ...ticks(2), ...shoot(2, 'c')])
    expect(s).toMatchObject({ name: 'preview', shot: 2, photos: ['a', 'b', 'c'] })
    expect(run(ticks(2), s)).toEqual({ name: 'finishing', photos: ['a', 'b', 'c'] })
  })

  it('"Looks good" skips the rest of the preview time', () => {
    const s = run([{ type: 'START' }, ...shoot(3, 'a'), { type: 'NEXT' }])
    expect(s).toMatchObject({ name: 'countdown', shot: 1 })
  })

  it('retake from the preview reshoots that photo right away and replaces it', () => {
    let s = run([{ type: 'START' }, ...shoot(3, 'a'), { type: 'RETAKE' }])
    expect(s).toMatchObject({ name: 'countdown', shot: 0, remaining: 2, retakesUsed: 1 })
    s = run(shoot(2, 'a2'), s)
    expect(s).toMatchObject({ name: 'preview', shot: 0, photos: ['a2'] })
    expect(retakesLeft(s, cfg)).toBe(0)
  })

  it('respects the retake limit', () => {
    const s = run([{ type: 'START' }, ...shoot(3, 'a'), { type: 'RETAKE' }, ...shoot(2, 'a2')])
    expect(run([{ type: 'RETAKE' }], s)).toBe(s)
  })

  it('with preview time 0, photos are not shown and there is no retake', () => {
    const quick = { ...cfg, reviewSeconds: 0 }
    let s = run([{ type: 'START' }, ...shoot(3, 'a')], { name: 'welcome' }, quick)
    expect(s).toMatchObject({ name: 'countdown', shot: 1, photos: ['a'] })
    s = run([...shoot(2, 'b'), ...shoot(2, 'c')], s, quick)
    expect(s).toEqual({ name: 'finishing', photos: ['a', 'b', 'c'] })
  })

  it('ignores captures that arrive in the wrong state (e.g. double events)', () => {
    const s = run([{ type: 'START' }])
    expect(run([{ type: 'CAPTURED', path: 'x' }], s)).toBe(s)
  })

  it('camera failure keeps earlier photos and can retry the same shot', () => {
    let s = run([{ type: 'START' }, ...shoot(3, 'a'), ...ticks(2), ...ticks(2), { type: 'CAPTURE_FAILED', message: 'focus' }])
    expect(s).toMatchObject({ name: 'error', shot: 1, photos: ['a'] })
    s = run([{ type: 'RETRY_SHOT' }], s)
    expect(s).toMatchObject({ name: 'countdown', shot: 1, photos: ['a'] })
  })

  it('finishing → done → reset', () => {
    let s: BoothState = { name: 'finishing', photos: ['a', 'b', 'c'] }
    s = run([{ type: 'FINISHED' }], s)
    expect(s.name).toBe('done')
    expect(run([{ type: 'RESET' }], s)).toEqual({ name: 'welcome' })
  })

  it('FINISHED outside finishing is ignored', () => {
    const s: BoothState = { name: 'welcome' }
    expect(run([{ type: 'FINISHED' }], s)).toBe(s)
  })
})
