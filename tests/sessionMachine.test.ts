import { describe, expect, it } from 'vitest'
import { boothReducer, retakesLeft, type BoothAction, type BoothConfig, type BoothState } from '../src/shared/sessionMachine'

const cfg: BoothConfig = { photosPerSession: 3, firstCountdownSeconds: 3, intervalSeconds: 2, reviewSeconds: 2, retakesAllowed: 1, boomerang: false }
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

describe('boomerang', () => {
  const withBoomerang = { ...cfg, reviewSeconds: 0, photosPerSession: 1, boomerang: true }

  it('records a boomerang after the last photo, then finishes', () => {
    const afterPhoto = run([{ type: 'START' }, ...ticks(3), { type: 'CAPTURED', path: 'a.jpg' }], undefined, withBoomerang)
    expect(afterPhoto).toEqual({ name: 'boomerangCountdown', remaining: 3, photos: ['a.jpg'] })
    const recording = run(ticks(3), afterPhoto, withBoomerang)
    expect(recording).toEqual({ name: 'boomerang', photos: ['a.jpg'] })
    expect(run([{ type: 'BOOMERANG_DONE' }], recording, withBoomerang)).toEqual({ name: 'finishing', photos: ['a.jpg'] })
  })

  it('goes straight to finishing when the event has no boomerang', () => {
    const s = run([{ type: 'START' }, ...ticks(3), { type: 'CAPTURED', path: 'a.jpg' }], undefined, { ...withBoomerang, boomerang: false })
    expect(s.name).toBe('finishing')
  })

  it('ignores BOOMERANG_DONE outside recording', () => {
    expect(run([{ type: 'BOOMERANG_DONE' }])).toEqual({ name: 'welcome' })
  })
})

describe('ending a session early', () => {
  const started = run([{ type: 'START' }])
  const firstPreview = run([{ type: 'START' }, ...shoot(3, 'a')])

  it('ends from a countdown, keeping the photos taken so far and printing nothing', () => {
    expect(run([{ type: 'END' }], started)).toEqual({ name: 'ended', photos: [], reason: 'guest' })
    const midway = run([{ type: 'NEXT' }, { type: 'TICK' }], firstPreview)
    expect(run([{ type: 'END' }], midway)).toEqual({ name: 'ended', photos: ['a'], reason: 'guest' })
  })

  it('ends from a photo preview, a camera error, while capturing or before the boomerang', () => {
    expect(run([{ type: 'END' }], firstPreview)).toMatchObject({ name: 'ended', photos: ['a'] })
    const failed = run([...ticks(3), { type: 'CAPTURE_FAILED', message: 'x' }], started)
    expect(run([{ type: 'END' }], failed)).toMatchObject({ name: 'ended' })
    expect(run([{ type: 'END' }], run(ticks(3), started))).toMatchObject({ name: 'ended' })
    const boomerangCfg = { ...cfg, photosPerSession: 1, boomerang: true }
    const before = run([{ type: 'START' }, ...shoot(3, 'a'), { type: 'NEXT' }], { name: 'welcome' }, boomerangCfg)
    expect(before.name).toBe('boomerangCountdown')
    expect(run([{ type: 'END' }], before, boomerangCfg)).toMatchObject({ name: 'ended', photos: ['a'] })
  })

  it("can't end once the print is being made, and a late photo is ignored", () => {
    const finishing: BoothState = { name: 'finishing', photos: ['a', 'b', 'c'] }
    expect(run([{ type: 'END' }], finishing)).toBe(finishing)
    expect(run([{ type: 'END' }], { name: 'welcome' })).toEqual({ name: 'welcome' })
    const ended = run([...ticks(3), { type: 'END' }], started)
    expect(run([{ type: 'CAPTURED', path: 'late' }], ended)).toBe(ended)
    expect(run([{ type: 'RESET' }], ended)).toEqual({ name: 'welcome' })
  })
})

describe('only print when the guest taps Print', () => {
  const confirm: BoothConfig = { ...cfg, confirmPrint: true, confirmPrintSeconds: 30 }
  const lastPreview = run([{ type: 'START' }, ...shoot(3, 'a'), { type: 'NEXT' }, ...shoot(2, 'b'), { type: 'NEXT' }, ...shoot(2, 'c')], { name: 'welcome' }, confirm)

  it('waits on the last photo for the longer confirm time', () => {
    expect(lastPreview).toMatchObject({ name: 'preview', shot: 2, remaining: 30 })
  })

  it('prints on Print, but ends without printing when nobody taps', () => {
    expect(run([{ type: 'NEXT' }], lastPreview, confirm)).toEqual({ name: 'finishing', photos: ['a', 'b', 'c'] })
    expect(run(ticks(30), lastPreview, confirm)).toEqual({ name: 'ended', photos: ['a', 'b', 'c'], reason: 'walked away' })
  })

  it('still shows the last photo when per-photo review is off', () => {
    const noReview = { ...confirm, reviewSeconds: 0 }
    const s = run([{ type: 'START' }, ...shoot(3, 'a'), ...shoot(2, 'b'), ...shoot(2, 'c')], { name: 'welcome' }, noReview)
    expect(s).toMatchObject({ name: 'preview', shot: 2, remaining: 30 })
  })

  it('earlier photos keep the normal review time and move on by themselves', () => {
    const s = run([{ type: 'START' }, ...shoot(3, 'a')], { name: 'welcome' }, confirm)
    expect(s).toMatchObject({ name: 'preview', remaining: 2 })
    expect(run(ticks(2), s, confirm)).toMatchObject({ name: 'countdown', shot: 1 })
  })
})
