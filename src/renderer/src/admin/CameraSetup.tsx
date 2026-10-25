import { useEffect, useState } from 'react'
import type { DeviceSnapshot } from '@shared/api'
import { describeExposure, EXPOSURE_LABELS, PRESETS, step } from '@shared/exposure'
import type { ExposureKey, ExposureSettings, ExposureState, TestShot } from '@shared/types'
import LiveView from '../components/LiveView'

/** IPC errors arrive wrapped ("Error invoking remote method …"); operators only need the message. */
const message = (e: unknown) => String(e instanceof Error ? e.message : e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

const KEYS: ExposureKey[] = ['iso', 'aperture', 'shutter', 'whiteBalance']

/** What the arrows do, in words a non-photographer understands. */
const ARROW_HINT: Record<ExposureKey, string> = {
  iso: '◀ darker · brighter ▶',
  aperture: '◀ brighter · darker, more of the group sharp ▶',
  shutter: '◀ more room light · less room light ▶',
  whiteBalance: 'Use Flash for flash photos'
}

const VERDICT = {
  dark: 'Too dark. Turn ISO up one or two steps, or turn up the flash power.',
  bright: 'Too bright: faces may turn pure white. Turn ISO down, or the flash power down.',
  good: 'Brightness looks good. Tap the photo to check focus.'
}

const show = (key: ExposureKey, v: string) => (key === 'aperture' ? `f/${v}` : key === 'iso' && v !== 'Auto' ? `ISO ${v}` : v)

/**
 * Without `event`, changes are remembered on the active event. During event setup, `event` is the
 * event being set up and its saved exposure is put on the camera when the screen opens.
 */
export default function CameraSetup({ devices, event }: { devices: DeviceSnapshot | null; event?: { id: string; name: string; exposure?: ExposureSettings } }) {
  const [state, setState] = useState<ExposureState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [shots, setShots] = useState<TestShot[]>([])
  const [view, setView] = useState<number | 'live'>('live')
  const [zoom, setZoom] = useState(false)
  const [eventName, setEventName] = useState<string | null>(null)
  const cameraState = devices?.camera.state

  const load = async () => {
    try {
      setState(await window.booth.getExposure())
      setError(null)
    } catch (e) {
      setState(null)
      setError(message(e))
    }
  }

  useEffect(() => {
    if (event) {
      setEventName(event.name)
      if (event.exposure) void window.booth.applyExposure(event.exposure, event.id).then((r) => setState(r.state)).catch(() => undefined)
    } else {
      window.booth.getActiveEvent().then((a) => setEventName(a?.event.name ?? null))
    }
    return window.booth.onExposure(() => void load())
  }, [event?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // Reload when the camera (re)connects; ignore 'busy' blips during a shot.
  useEffect(() => {
    if (cameraState !== 'busy') void load()
  }, [cameraState])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setNotice(null)
    try {
      await fn()
      setError(null)
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }

  const set = (key: ExposureKey, value: string | undefined) =>
    value && value !== state?.current[key] && run(async () => setState(await window.booth.setExposure(key, value, event?.id)))

  const applyPreset = (id: string) =>
    run(async () => {
      const preset = PRESETS.find((p) => p.id === id)!
      const res = await window.booth.applyExposure(preset.settings, event?.id)
      setState(res.state)
      if (res.skipped.length) setNotice(`Couldn't set ${res.skipped.map((k) => EXPOSURE_LABELS[k].toLowerCase()).join(', ')} on the camera.`)
    })

  const takeShot = () =>
    run(async () => {
      const shot = await window.booth.testShot()
      setShots((s) => [shot, ...s].slice(0, 6))
      setView(0)
    })

  const shot = view === 'live' ? null : shots[view]
  const activePreset = state && PRESETS.find((p) => KEYS.every((k) => !p.settings[k] || p.settings[k] === state.current[k]))?.id

  return (
    <section className="cam">
      <div className="cam-stage">
        <div className="cam-view">
          {view === 'live' ? <LiveView active /> : shot && <img src={shot.preview} alt="Test shot" onClick={() => setZoom(true)} />}
          <span className="cam-chip">{shot ? describeExposure(shot.settings) : 'Live view · framing only'}</span>
        </div>
        {shot ? (
          <div className={`cam-verdict ${shot.verdict}`}>
            <Histogram bins={shot.histogram} />
            <p>{VERDICT[shot.verdict]}</p>
          </div>
        ) : (
          <p className="muted small">With flash, the live view can't show how bright the photo will be. Take a test shot to check.</p>
        )}
        <div className="cam-strip">
          <button className={view === 'live' ? 'on' : ''} onClick={() => setView('live')}>Live</button>
          {shots.map((s, i) => (
            <button key={s.takenAt} className={view === i ? 'on' : ''} onClick={() => setView(i)} title={describeExposure(s.settings)}>
              <img src={s.preview} alt="" />
            </button>
          ))}
        </div>
      </div>

      <div className="cam-side">
        <button className="btn primary huge-ish" disabled={busy || cameraState !== 'ready'} onClick={takeShot}>{busy ? 'Working…' : '📷  Take test shot'}</button>
        {error && (
          <div className="note">
            <p className="warn">{error}</p>
            <button className="btn small" onClick={() => run(async () => (await window.booth.reconnectCamera(), await load()))}>Reconnect camera</button>
          </div>
        )}
        {state && !state.manual && state.mode && (
          <div className="note attention">
            <p>The camera is in <strong>{state.mode}</strong> mode.</p>
            <p className="small">Turn the mode dial to <strong>M</strong> so the booth can control exposure.</p>
          </div>
        )}

        {state && (
          <>
            <div className="field">
              <span className="field-label">Start from</span>
              <div className="presets">
                {PRESETS.map((p) => (
                  <button key={p.id} disabled={busy || !state.manual} className={activePreset === p.id ? 'on' : ''} onClick={() => applyPreset(p.id)}>
                    <strong>{p.name}</strong>
                    <span>{p.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {KEYS.map((k) => {
              const opts = state.options[k]
              const cur = state.current[k]
              // The camera may already be set to something we don't offer (e.g. a shutter speed too fast for flash).
              const list = cur && !opts.includes(cur) ? [cur, ...opts] : opts
              return (
                <div key={k} className="stepper">
                  <span className="field-label">{EXPOSURE_LABELS[k]}</span>
                  <div className="stepper-row">
                    <button disabled={busy || !opts.length || cur === opts[0]} onClick={() => set(k, step(opts, cur, -1))} aria-label={`Lower ${EXPOSURE_LABELS[k]}`}>◀</button>
                    <select disabled={busy || !opts.length} value={cur ?? ''} onChange={(e) => set(k, e.target.value)}>
                      {list.map((v) => <option key={v} value={v} disabled={!opts.includes(v)}>{show(k, v)}{opts.includes(v) ? '' : ' (not available)'}</option>)}
                    </select>
                    <button disabled={busy || !opts.length || cur === opts[opts.length - 1]} onClick={() => set(k, step(opts, cur, 1))} aria-label={`Raise ${EXPOSURE_LABELS[k]}`}>▶</button>
                  </div>
                  <span className="muted small">{ARROW_HINT[k]}</span>
                </div>
              )
            })}
          </>
        )}

        {notice && <p className="warn small">{notice}</p>}
        <p className="muted small">
          {eventName ? <>Saved for <strong>{eventName}</strong>. Put back on the camera when this event is launched and whenever the camera reconnects.</> : 'No active event: changes apply to the camera now, but aren’t remembered.'}
        </p>
      </div>

      {zoom && shot && (
        <div className="modal" onClick={() => setZoom(false)}>
          <img src={shot.preview} alt="Test shot, full size" />
          <button className="btn">Close</button>
        </div>
      )}
    </section>
  )
}

function Histogram({ bins }: { bins: number[] }) {
  const max = Math.max(...bins, 1e-6)
  return (
    <div className="histogram" aria-label="Brightness histogram: dark on the left, bright on the right">
      {bins.map((b, i) => <i key={i} style={{ height: `${Math.max(2, (b / max) * 100)}%` }} />)}
    </div>
  )
}
