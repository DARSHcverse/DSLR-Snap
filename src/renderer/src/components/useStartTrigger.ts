import { useEffect, useRef } from 'react'
import { isPedalKey } from '@shared/trigger'

/** Holding the pedal this long during a session ends it (the operator's "stop" without a screen). */
export const PEDAL_HOLD_MS = 1500

/**
 * Hands-free start for every booth type: the phone remote's Start button, or a foot pedal / clicker
 * (they type a key). `onTrigger` decides what a press means on the current screen.
 * With `hold`, holding the pedal for PEDAL_HOLD_MS calls `hold.onHold`, but only when the press
 * began while `hold.armed()` was true (a session in progress), so a long press on the start screen
 * can't start and then immediately end a session. The phone remote's End button calls it too.
 */
export function useStartTrigger(onTrigger: () => void, hold?: { armed: () => boolean; onHold: () => void }): void {
  const handler = useRef(onTrigger)
  handler.current = onTrigger
  const holdRef = useRef(hold)
  holdRef.current = hold
  useEffect(() => {
    let pedal = 'auto'
    let timer: ReturnType<typeof setTimeout> | undefined
    window.booth.getDeviceSettings().then((s) => (pedal = s.pedalKey ?? 'auto')).catch(() => undefined)
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (!isPedalKey(e, pedal)) return
      e.preventDefault() // Space/Enter would otherwise also "click" a focused button
      if (holdRef.current?.armed()) {
        clearTimeout(timer)
        timer = setTimeout(() => holdRef.current?.onHold(), PEDAL_HOLD_MS)
        return
      }
      handler.current()
    }
    const onKeyUp = () => clearTimeout(timer)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    const offStart = window.booth.onRemoteStart(() => handler.current())
    const offEnd = window.booth.onRemoteEnd(() => holdRef.current?.armed() && holdRef.current.onHold())
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
      offStart()
      offEnd()
    }
  }, [])
}
