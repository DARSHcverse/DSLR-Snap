import { useEffect, useRef } from 'react'
import { isPedalKey } from '@shared/trigger'

/**
 * Hands-free start for every booth type: the phone remote's Start button, or a foot pedal / clicker
 * (they type a key). `onTrigger` decides what a press means on the current screen.
 */
export function useStartTrigger(onTrigger: () => void): void {
  const handler = useRef(onTrigger)
  handler.current = onTrigger
  useEffect(() => {
    let pedal = 'auto'
    window.booth.getDeviceSettings().then((s) => (pedal = s.pedalKey ?? 'auto')).catch(() => undefined)
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (!isPedalKey(e, pedal)) return
      e.preventDefault() // Space/Enter would otherwise also "click" a focused button
      handler.current()
    }
    window.addEventListener('keydown', onKey)
    const off = window.booth.onRemoteStart(() => handler.current())
    return () => {
      window.removeEventListener('keydown', onKey)
      off()
    }
  }, [])
}
