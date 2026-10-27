import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { DeviceSnapshot } from '@shared/api'
import { boothReducer, retakesLeft, type BoothAction, type BoothConfig, type BoothState } from '@shared/sessionMachine'
import type { BoothEvent, FinishResult, Template } from '@shared/types'
import Gallery, { GalleryCorner } from '../components/Gallery'
import { lookInfo } from '@shared/looks'
import LiveView from '../components/LiveView'

interface Props {
  /** Opens the operator menu (through the PIN keypad when a PIN is set). */
  onNeedSetup: () => void
}

type Active = { event: BoothEvent; template: Template }

function configFor(a: Active | null | undefined): BoothConfig {
  if (!a) return { photosPerSession: 1, firstCountdownSeconds: 3, intervalSeconds: 3, reviewSeconds: 3, retakesAllowed: 0, boomerang: false }
  return {
    photosPerSession: a.template.slots.length,
    firstCountdownSeconds: a.event.countdownSeconds,
    intervalSeconds: a.event.shotIntervalSeconds,
    reviewSeconds: a.event.photoReviewSeconds,
    retakesAllowed: a.event.retakesAllowed,
    boomerang: a.event.boomerang
  }
}

export default function Booth({ onNeedSetup }: Props) {
  const [active, setActive] = useState<Active | null | undefined>(undefined)
  const [devices, setDevices] = useState<DeviceSnapshot | null>(null)
  const [paused, setPaused] = useState(false)
  useEffect(() => window.booth.onPaused(setPaused), [])
  const cfg = configFor(active)
  const cfgRef = useRef(cfg)
  cfgRef.current = cfg

  const [state, dispatch] = useReducer((s: BoothState, a: BoothAction) => boothReducer(s, a, cfgRef.current), { name: 'welcome' })
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [result, setResult] = useState<FinishResult | null>(null)
  const [doneView, setDoneView] = useState<'print' | 'colour' | 'boomerang'>('print')
  const [flash, setFlash] = useState(false)
  const [fatal, setFatal] = useState<string | null>(null)
  const [gallery, setGallery] = useState<Awaited<ReturnType<typeof window.booth.galleryList>>>([])
  const [galleryOpen, setGalleryOpen] = useState(false)
  const sessionId = useRef<string | null>(null)

  useEffect(() => {
    window.booth.getActiveEvent().then(setActive)
    window.booth.getDevices().then(setDevices)
    return window.booth.onDevices(setDevices)
  }, [])

  // Refresh the gallery corner whenever the booth is back on the welcome screen.
  useEffect(() => {
    if (state.name === 'welcome') window.booth.galleryList().then(setGallery).catch(() => setGallery([]))
    else setGalleryOpen(false)
  }, [state.name, active?.event.id])

  // Countdown and photo-preview ticks
  useEffect(() => {
    if (state.name !== 'countdown' && state.name !== 'preview' && state.name !== 'boomerangCountdown') return
    const t = setTimeout(() => dispatch({ type: 'TICK' }), 1000)
    return () => clearTimeout(t)
  }, [state])

  // Shutter
  useEffect(() => {
    if (state.name !== 'capturing' || !sessionId.current) return
    let cancelled = false
    setFlash(true)
    setTimeout(() => setFlash(false), 350)
    window.booth
      .capture(sessionId.current)
      .then((r) => {
        if (cancelled) return
        setPreviews((p) => ({ ...p, [r.path]: r.preview }))
        dispatch({ type: 'CAPTURED', path: r.path })
      })
      .catch((e: Error) => !cancelled && dispatch({ type: 'CAPTURE_FAILED', message: cleanError(e) }))
    return () => {
      cancelled = true
    }
  }, [state.name, state.name === 'capturing' ? state.shot : -1]) // eslint-disable-line react-hooks/exhaustive-deps

  // Boomerang: record from the live view; carry on to printing whatever happens.
  useEffect(() => {
    if (state.name !== 'boomerang' || !sessionId.current) return
    window.booth
      .recordBoomerang(sessionId.current)
      .catch(() => false)
      .finally(() => dispatch({ type: 'BOOMERANG_DONE' }))
  }, [state.name]) // eslint-disable-line react-hooks/exhaustive-deps

  // Compose + print
  useEffect(() => {
    if (state.name !== 'finishing' || !sessionId.current) return
    window.booth
      .finish(sessionId.current, state.photos, crypto.randomUUID())
      .then((r) => {
        setResult(r)
        dispatch({ type: 'FINISHED' })
      })
      .catch((e: Error) => setFatal(cleanError(e)))
  }, [state.name]) // eslint-disable-line react-hooks/exhaustive-deps

  // The final screen returns to "Tap to start" by itself after the event's chosen time.
  useEffect(() => {
    if (state.name !== 'done' || !active) return
    const t = setTimeout(() => reset(), active.event.doneScreenSeconds * 1000)
    return () => clearTimeout(t)
  }, [state.name]) // eslint-disable-line react-hooks/exhaustive-deps

  const reset = useCallback(() => {
    sessionId.current = null
    setPreviews({})
    setResult(null)
    setDoneView('print')
    setFatal(null)
    dispatch({ type: 'RESET' })
  }, [])

  const start = async () => {
    try {
      const fresh = await window.booth.getActiveEvent()
      setActive(fresh)
      if (!fresh) return onNeedSetup()
      cfgRef.current = configFor(fresh)
      const s = await window.booth.startSession()
      sessionId.current = s.sessionId
      dispatch({ type: 'START' })
    } catch (e) {
      setFatal(cleanError(e as Error))
    }
  }

  if (active === undefined) return <div className="screen center"><div className="spinner" /></div>

  if (active === null) {
    return (
      <div className="screen center">
        <h1 className="display">No event selected</h1>
        <p className="muted">Open the operator menu to create an event.</p>
        <button className="btn primary" onClick={onNeedSetup}>Open admin</button>
      </div>
    )
  }

  if (fatal) {
    return (
      <div className="screen center">
        <h1 className="display small">Something went wrong</h1>
        <p className="muted">{fatal}</p>
        <button className="btn primary" onClick={reset}>Back to start</button>
      </div>
    )
  }

  const cameraReady = devices?.camera.state === 'ready' || devices?.camera.state === 'busy'
  const showLive = state.name === 'countdown' || state.name === 'capturing'
  const boomerangLive = state.name === 'boomerangCountdown' || state.name === 'boomerang'
  // The feed runs from "Tap to start" through every photo (also behind the photo review),
  // so guests see themselves the whole time and the camera never restarts mid-session.
  const liveOn = cameraReady && (state.name === 'welcome' || showLive || state.name === 'preview' || boomerangLive)

  return (
    <div className="screen booth">
      {paused && state.name === 'welcome' && (
        <div className="paused-overlay">
          <p className="eyebrow">{active.event.name}</p>
          <h1 className="display small">Back in a moment</h1>
          <p className="muted">The photo booth is taking a short break.</p>
        </div>
      )}
      {flash && <div className="flash" />}
      <LiveView active={liveOn} hint={showLive ? 'Look at the camera ↑' : undefined} filter={lookInfo(active.event.look).liveView} />

      {state.name === 'welcome' && (
        <div className={`welcome${liveOn ? ' over-live' : ''}`} onClick={cameraReady ? start : undefined}>
          <p className="eyebrow">{active.event.name}</p>
          <h1 className="display">Tap to start</h1>
          <p className="muted">
            {cfg.photosPerSession} photo{cfg.photosPerSession > 1 ? 's' : ''} · {active.event.countdownSeconds}s countdown
          </p>
          <button className="btn huge primary" disabled={!cameraReady} onClick={(e) => (e.stopPropagation(), start())}>
            {cameraReady ? 'Start' : 'Camera not ready'}
          </button>
          {!cameraReady && devices && <p className="warn">{devices.camera.message ?? 'Waiting for camera…'}</p>}
          <button className="operator-btn" aria-label="Operator menu" onClick={(e) => (e.stopPropagation(), onNeedSetup())}>⚙</button>
          <GalleryCorner items={gallery} onOpen={() => setGalleryOpen(true)} />
        </div>
      )}
      {boomerangLive && (
        <div className="capture-stage">
          <div className="shot-counter">Boomerang</div>
          {state.name === 'boomerangCountdown' ? (
            <div className="countdown" key={state.remaining}>{state.remaining}</div>
          ) : (
            <div className="countdown smile recording">Move!</div>
          )}
        </div>
      )}
      {state.name === 'welcome' && galleryOpen && <Gallery items={gallery} onClose={() => setGalleryOpen(false)} />}

      {showLive && (
        <div className="capture-stage">
          <div className="shot-counter">
            Photo {state.shot + 1} of {cfg.photosPerSession}
          </div>
          {state.name === 'countdown' && <div className="countdown" key={state.remaining}>{state.remaining}</div>}
          {state.name === 'capturing' && <div className="countdown smile">Smile!</div>}
        </div>
      )}

      {state.name === 'preview' && (
        <div className="preview" onClick={() => dispatch({ type: 'NEXT' })}>
          <img src={previews[state.photos[state.shot]]} alt={`Photo ${state.shot + 1}`} style={{ filter: lookInfo(active.event.look).liveView }} />
          <div className="shot-counter">Photo {state.shot + 1} of {cfg.photosPerSession}</div>
          {retakesLeft(state, cfg) > 0 && (
            <button className="close-x preview-x" aria-label="Retake this photo" onClick={(e) => (e.stopPropagation(), dispatch({ type: 'RETAKE' }))}>✕</button>
          )}
          <div className="preview-bar" onClick={(e) => e.stopPropagation()}>
            {retakesLeft(state, cfg) > 0 ? (
              <button className="btn huge ghost" onClick={() => dispatch({ type: 'RETAKE' })}>
                ↺ Retake{cfg.retakesAllowed > 1 ? ` (${retakesLeft(state, cfg)} left)` : ''}
              </button>
            ) : (
              <p className="muted">No retakes left</p>
            )}
            <button className="btn huge primary" onClick={() => dispatch({ type: 'NEXT' })}>
              {state.photos.length >= cfg.photosPerSession ? (active.event.autoPrint && active.event.printCopies > 0 ? 'Print ▶' : 'Done ▶') : 'Looks good ▶'}
            </button>
          </div>
          <div className="preview-timer" key={state.shot + ':' + state.retakesUsed} style={{ animationDuration: `${cfg.reviewSeconds}s` }} />
        </div>
      )}

      {state.name === 'finishing' && (
        <div className="center">
          <div className="spinner" />
          <h2 className="title">Creating your photos…</h2>
        </div>
      )}

      {state.name === 'done' && result && (
        <div className="done">
          <img className="final" src={(doneView === 'colour' && result.colourPreview) || (doneView === 'boomerang' && result.boomerang) || result.printPreview} alt="Your print" />
          <div className="done-side">
            {(result.colourPreview || result.boomerang) && (
              <div className="seg done-choice">
                <button className={doneView === 'print' ? 'on' : ''} onClick={() => setDoneView('print')}>{result.colourPreview ? lookInfo(active.event.look).label : 'Photo'}</button>
                {result.colourPreview && <button className={doneView === 'colour' ? 'on' : ''} onClick={() => setDoneView('colour')}>Colour</button>}
                {result.boomerang && <button className={doneView === 'boomerang' ? 'on' : ''} onClick={() => setDoneView('boomerang')}>Boomerang</button>}
              </div>
            )}
            <h2 className="title">{result.printJobId ? 'Printing now!' : 'All done!'}</h2>
            {result.printJobId && <p className="muted">Your print will be ready in about 15 seconds.</p>}
            {result.qrDataUrl ? (
              <div className="qr">
                <img src={result.qrDataUrl} alt="QR code for your photos" />
                <p>Scan to download</p>
              </div>
            ) : (
              active.event.galleryEnabled && <p className="muted">Digital copy will upload when the booth is back online.</p>
            )}
            <button className="btn primary" onClick={reset}>Finish</button>
          </div>
        </div>
      )}

      {state.name === 'error' && (
        <div className="center">
          <h2 className="title">Oops — the camera missed that one</h2>
          <p className="muted">{state.message}</p>
          <div className="row">
            <button className="btn primary" onClick={() => dispatch({ type: 'RETRY_SHOT' })}>Try again</button>
            <button className="btn ghost" onClick={reset}>Start over</button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Electron prefixes IPC errors with "Error invoking remote method ..." — guests don't need that. */
function cleanError(e: Error): string {
  return (e?.message ?? String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}
