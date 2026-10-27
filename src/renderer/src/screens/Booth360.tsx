import { useCallback, useEffect, useState } from 'react'
import type { DeviceSnapshot } from '@shared/api'
import type { BoothEvent, VideoResult } from '@shared/types'
import { useStartTrigger } from '../components/useStartTrigger'

type State =
  | { name: 'welcome' }
  | { name: 'countdown'; remaining: number }
  | { name: 'spinning'; elapsed: number }
  | { name: 'editing' }
  | { name: 'done'; result: VideoResult; playback: string }
  | { name: 'error'; message: string }

const COUNTDOWN = 3

/**
 * 360 booth: guests step onto the platform, the GoPro on the arm records the spin, and the app
 * makes the slow-motion edit with the event's overlay and music.
 */
export default function Booth360({ event, devices, paused, onNeedSetup }: {
  event: BoothEvent
  devices: DeviceSnapshot | null
  paused: boolean
  onNeedSetup: () => void
}) {
  const [state, setState] = useState<State>({ name: 'welcome' })
  const ready = devices?.gopro.state === 'ready'

  const reset = useCallback(() => {
    setState((s) => {
      if (s.name === 'done') URL.revokeObjectURL(s.playback)
      return { name: 'welcome' }
    })
  }, [])

  const start = async () => {
    if (!ready || paused) return
    setState({ name: 'countdown', remaining: COUNTDOWN })
  }

  // Pedal / phone remote: start a spin from the start screen, or finish the final screen. Presses
  // during a countdown, spin or edit are ignored, so a double press can't cut a spin short.
  useStartTrigger(() => {
    if (state.name === 'welcome') void start()
    else if (state.name === 'done' || state.name === 'error') reset()
  })

  // 3-2-1, then record (the app drives the GoPro) and edit.
  useEffect(() => {
    if (state.name !== 'countdown') return
    const t = setTimeout(async () => {
      if (state.remaining > 1) return setState({ name: 'countdown', remaining: state.remaining - 1 })
      setState({ name: 'spinning', elapsed: 0 })
      try {
        const { sessionId } = await window.booth.startSession()
        const result = await window.booth.record360(sessionId)
        const playback = result.video ? URL.createObjectURL(new Blob([result.video], { type: 'video/mp4' })) : ''
        setState({ name: 'done', result, playback })
      } catch (e) {
        setState({ name: 'error', message: e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : String(e) })
      }
    }, 1000)
    return () => clearTimeout(t)
  }, [state])

  // Spin timer; after the spin, the edit is being made.
  useEffect(() => {
    if (state.name !== 'spinning') return
    if (state.elapsed >= event.spinSeconds) return setState({ name: 'editing' })
    const t = setTimeout(() => setState((s) => (s.name === 'spinning' ? { name: 'spinning', elapsed: s.elapsed + 1 } : s)), 1000)
    return () => clearTimeout(t)
  }, [state, event.spinSeconds])

  useEffect(() => {
    if (state.name !== 'done' && state.name !== 'error') return
    const t = setTimeout(reset, event.doneScreenSeconds * 1000 + (state.name === 'done' ? 15_000 : 0))
    return () => clearTimeout(t)
  }, [state.name, event.doneScreenSeconds, reset])

  return (
    <div className="screen booth booth-360">
      {paused && state.name === 'welcome' && (
        <div className="paused-overlay">
          <p className="eyebrow">{event.name}</p>
          <h1 className="display small">Back in a moment</h1>
          <p className="muted">The 360 booth is taking a short break.</p>
        </div>
      )}

      {state.name === 'welcome' && (
        <div className="welcome" onClick={start}>
          <p className="eyebrow">{event.name}</p>
          <h1 className="display">360°</h1>
          <p className="muted">Step onto the platform, strike a pose, and get ready to move.</p>
          <button className="btn huge primary" disabled={!ready} onClick={(e) => (e.stopPropagation(), void start())}>
            {ready ? 'Start' : 'Camera not ready'}
          </button>
          {!ready && <p className="warn">{devices?.gopro.message ?? 'Looking for the GoPro…'}</p>}
          <button className="operator-btn" aria-label="Operator menu" onClick={(e) => (e.stopPropagation(), onNeedSetup())}>⚙</button>
        </div>
      )}

      {state.name === 'countdown' && (
        <div className="center">
          <p className="eyebrow">Get ready</p>
          <div className="countdown" key={state.remaining}>{state.remaining}</div>
        </div>
      )}

      {state.name === 'spinning' && (
        <div className="center">
          <div className="shot-counter rec">● REC {Math.max(0, event.spinSeconds - state.elapsed)}s</div>
          <h1 className="display recording">Spin!</h1>
          <p className="muted">Wave, dance, show off. Keep moving!</p>
        </div>
      )}

      {state.name === 'editing' && (
        <div className="center">
          <div className="spinner" />
          <h2 className="title">Making your 360 video…</h2>
          <p className="muted">Adding the slow motion and music. Step off the platform carefully.</p>
        </div>
      )}

      {state.name === 'done' && (
        <div className="done">
          {state.playback ? <video className="final portrait" src={state.playback} autoPlay loop playsInline /> : <img className="final" src={state.result.poster} alt="" />}
          <div className="done-side">
            <h2 className="title">That's a wrap!</h2>
            {state.result.qrDataUrl ? (
              <div className="qr">
                <img src={state.result.qrDataUrl} alt="QR code for your 360 video" />
                <p>Scan to download</p>
              </div>
            ) : (
              <p className="muted">Your video is saved for {event.name}.</p>
            )}
            <button className="btn primary" onClick={reset}>Finish</button>
          </div>
        </div>
      )}

      {state.name === 'error' && (
        <div className="center">
          <h2 className="title">That spin didn't save</h2>
          <p className="muted">{state.message}</p>
          <button className="btn primary" onClick={reset}>Try again</button>
        </div>
      )}
    </div>
  )
}
