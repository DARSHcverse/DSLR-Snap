/**
 * Guest-facing booth flow as a pure reducer, so it can be unit tested without the UI.
 *
 * welcome → countdown → capturing → preview → (next shot: countdown) … → [boomerang] → finishing → done → welcome
 * Each photo is shown right after it's taken; the guest can retake it there (limited by
 * retakesAllowed) instead of waiting for the end. With reviewSeconds = 0 the preview is skipped.
 */

export interface BoothConfig {
  photosPerSession: number
  /** Countdown before the first photo. */
  firstCountdownSeconds: number
  /** Countdown before every later photo, and before a retake. */
  intervalSeconds: number
  /** How long each photo is shown after it's taken; 0 = don't show it. */
  reviewSeconds: number
  retakesAllowed: number
  /** After the last photo: "Boomerang! 3-2-1", then a short clip from the live view. */
  boomerang: boolean
}

/** Seconds of "Boomerang! 3, 2, 1" before recording. */
export const BOOMERANG_COUNTDOWN = 3

type Shooting = { shot: number; photos: string[]; retakesUsed: number }

export type BoothState =
  | { name: 'welcome' }
  | ({ name: 'countdown'; remaining: number } & Shooting)
  | ({ name: 'capturing' } & Shooting)
  | ({ name: 'preview'; remaining: number } & Shooting)
  | { name: 'boomerangCountdown'; remaining: number; photos: string[] }
  | { name: 'boomerang'; photos: string[] }
  | { name: 'finishing'; photos: string[] }
  | { name: 'done' }
  | ({ name: 'error'; message: string } & Shooting)

export type BoothAction =
  | { type: 'START' }
  | { type: 'TICK' }
  | { type: 'CAPTURED'; path: string }
  | { type: 'CAPTURE_FAILED'; message: string }
  | { type: 'RETAKE' }
  | { type: 'NEXT' }
  | { type: 'FINISHED' }
  | { type: 'RESET' }
  | { type: 'RETRY_SHOT' }
  /** The boomerang clip is recorded (or failed: the session carries on without it). */
  | { type: 'BOOMERANG_DONE' }

/** After a photo is accepted: next countdown, or finishing once every slot has a photo. */
function advance(s: Shooting, cfg: BoothConfig): BoothState {
  if (s.photos.length >= cfg.photosPerSession) {
    return cfg.boomerang ? { name: 'boomerangCountdown', remaining: BOOMERANG_COUNTDOWN, photos: s.photos } : { name: 'finishing', photos: s.photos }
  }
  return { name: 'countdown', shot: s.photos.length, remaining: cfg.intervalSeconds, photos: s.photos, retakesUsed: s.retakesUsed }
}

const shooting = (s: Shooting): Shooting => ({ shot: s.shot, photos: s.photos, retakesUsed: s.retakesUsed })

export function boothReducer(state: BoothState, action: BoothAction, cfg: BoothConfig): BoothState {
  switch (action.type) {
    case 'RESET':
      return { name: 'welcome' }

    case 'BOOMERANG_DONE':
      return state.name === 'boomerang' ? { name: 'finishing', photos: state.photos } : state

    case 'FINISHED':
      return state.name === 'finishing' ? { name: 'done' } : state

    case 'START':
      if (state.name !== 'welcome' && state.name !== 'done') return state
      return { name: 'countdown', shot: 0, remaining: cfg.firstCountdownSeconds, photos: [], retakesUsed: 0 }

    case 'TICK':
      if (state.name === 'countdown') {
        if (state.remaining > 1) return { ...state, remaining: state.remaining - 1 }
        return { name: 'capturing', ...shooting(state) }
      }
      if (state.name === 'boomerangCountdown') {
        return state.remaining > 1 ? { ...state, remaining: state.remaining - 1 } : { name: 'boomerang', photos: state.photos }
      }
      if (state.name === 'preview') {
        if (state.remaining > 1) return { ...state, remaining: state.remaining - 1 }
        return advance(state, cfg)
      }
      return state

    case 'CAPTURED': {
      if (state.name !== 'capturing') return state
      // Replaces the photo when this shot is a retake.
      const photos = [...state.photos]
      photos[state.shot] = action.path
      const next = { ...shooting(state), photos }
      return cfg.reviewSeconds > 0 ? { name: 'preview', remaining: cfg.reviewSeconds, ...next } : advance(next, cfg)
    }

    case 'NEXT':
      return state.name === 'preview' ? advance(state, cfg) : state

    case 'RETAKE':
      if (state.name !== 'preview' || state.retakesUsed >= cfg.retakesAllowed) return state
      return { name: 'countdown', remaining: cfg.intervalSeconds, ...shooting(state), retakesUsed: state.retakesUsed + 1 }

    case 'CAPTURE_FAILED':
      if (state.name !== 'capturing') return state
      return { name: 'error', message: action.message, ...shooting(state) }

    case 'RETRY_SHOT':
      if (state.name !== 'error') return state
      return { name: 'countdown', remaining: cfg.intervalSeconds, ...shooting(state) }
  }
}

export function retakesLeft(state: BoothState, cfg: BoothConfig): number {
  return 'retakesUsed' in state ? Math.max(0, cfg.retakesAllowed - state.retakesUsed) : cfg.retakesAllowed
}
