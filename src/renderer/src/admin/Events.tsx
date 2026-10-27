import { useEffect, useState } from 'react'
import type { DeviceSnapshot } from '@shared/api'
import { formatEventDate, todayIso } from '@shared/dates'
import { describeExposure } from '@shared/exposure'
import { LOOKS, lookInfo } from '@shared/looks'
import type { BoothEvent, Template } from '@shared/types'
import CameraSetup from './CameraSetup'
import { describe, DropZone, type Editing, message, startImport, TemplateEditor, TemplateThumb } from './Templates'

type Draft = Omit<BoothEvent, 'id' | 'createdAt'> & { id?: string }

const blankEvent = (templateId: string): Draft => ({
  name: '', date: todayIso(), templateId, photosPerSession: 3, countdownSeconds: 5, shotIntervalSeconds: 3, photoReviewSeconds: 3, doneScreenSeconds: 20,
  retakesAllowed: 2, printCopies: 1, autoPrint: true, galleryEnabled: false, showGallery: true,
  look: 'colour', skinSmoothing: 50, colourCopy: false, boomerang: false, backdrop: 'none', backgrounds: []
})

/** Big − / + control; easier on a touch screen than a number box. */
function Stepper({ label, hint, value, min, max, step = 1, format, onChange }: {
  label: string
  hint?: string
  value: number
  min: number
  max: number
  step?: number
  format?: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="num-stepper">
        <button disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))} aria-label={`Less: ${label}`}>−</button>
        <output>{format ? format(value) : value}</output>
        <button disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))} aria-label={`More: ${label}`}>+</button>
      </div>
      {hint && <span className="muted small">{hint}</span>}
    </div>
  )
}

const secs = (v: number) => `${v} s`

export default function EventsTab({ devices, onLaunch }: { devices: DeviceSnapshot | null; onLaunch: () => void }) {
  const [events, setEvents] = useState<BoothEvent[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setEvents(await window.booth.listEvents())
    setTemplates(await window.booth.listTemplates())
    setActiveId((await window.booth.getActiveEvent())?.event.id ?? null)
  }
  useEffect(() => void load(), [])

  const launch = async (id: string) => {
    await window.booth.setActiveEvent(id)
    onLaunch()
  }
  const act = (fn: () => Promise<unknown>) => async () => {
    try {
      await fn()
      setError(null)
      await load()
    } catch (e) {
      setError(message(e))
    }
  }

  if (editing) {
    return <EventSetup initial={editing} devices={devices} onClose={async () => (setEditing(null), await load())} onLaunch={launch} />
  }

  return (
    <section className="events">
      <div className="row between">
        <h2>Events</h2>
        <button className="btn primary" disabled={!templates.length} onClick={() => setEditing(blankEvent(templates[0].id))}>+ New event</button>
      </div>
      {events.length === 0 && <p className="muted">No events yet. Create one to start the booth.</p>}
      {error && <p className="warn">{error}</p>}
      <div className="event-grid">
        {events.map((ev) => {
          const t = templates.find((x) => x.id === ev.templateId)
          return (
            <div key={ev.id} className={`event-card${ev.id === activeId ? ' active' : ''}`}>
              <TemplateThumb id={ev.templateId} />
              <div className="event-info">
                <div className="row between">
                  <strong>{ev.name}</strong>
                  {ev.id === activeId && <span className="pill ok">Active</span>}
                </div>
                <span className="muted small">{formatEventDate(ev.date, { day: 'numeric', month: 'short', year: 'numeric' })} · {t ? describe(t) : 'missing template'}</span>
                <span className={`small ${ev.exposure ? 'muted' : 'warn'}`}>{ev.exposure ? `Camera: ${describeExposure(ev.exposure)}` : 'Camera not set up yet'}</span>
              </div>
              <div className="row">
                <button className="btn primary small" onClick={() => launch(ev.id)}>▶ Launch</button>
                <button className="btn small" onClick={() => setEditing(ev)}>Set up</button>
                <button className="btn small ghost" onClick={act(() => window.booth.duplicateEvent(ev.id))}>Duplicate</button>
                <button className="btn small ghost danger" onClick={act(async () => {
                  if (confirm(`Delete "${ev.name}" and its session history? Photo files on disk are kept.`)) await window.booth.deleteEvent(ev.id)
                })}>Delete</button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

const STEPS = ['Event', 'Template', 'Look', 'Camera', 'Print & share', 'Test & launch'] as const
const CAMERA_STEP = 3

function EventSetup({ initial, devices, onClose, onLaunch }: {
  initial: Draft
  devices: DeviceSnapshot | null
  onClose: () => void
  onLaunch: (id: string) => void
}) {
  const [draft, setDraft] = useState<Draft>(initial)
  const [step, setStep] = useState(0)
  const [visited, setVisited] = useState<Set<number>>(new Set(initial.id ? [0, 1, 2, 3, 4] : [0]))
  const [templates, setTemplates] = useState<Template[]>([])
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v })
  const template = templates.find((t) => t.id === draft.templateId)

  const loadTemplates = async () => setTemplates(await window.booth.listTemplates())
  useEffect(() => void loadTemplates(), [])

  /** Saves the form fields; exposure is saved by the camera step itself. Returns false if invalid. */
  const persist = async (): Promise<boolean> => {
    if (!draft.name.trim()) {
      setError('Give the event a name.')
      setStep(0)
      return false
    }
    try {
      const saved = await window.booth.saveEvent({ ...draft, name: draft.name.trim() })
      setDraft(saved)
      setError(null)
      return true
    } catch (e) {
      setError(message(e))
      return false
    }
  }

  const go = async (to: number) => {
    if (to === step) return
    // The camera step saved exposure directly; re-read it so the checklist is current.
    if (step === CAMERA_STEP && draft.id) {
      const fresh = (await window.booth.listEvents()).find((e) => e.id === draft.id)
      if (fresh) setDraft((d) => ({ ...d, exposure: fresh.exposure }))
    } else if (!(await persist())) return
    setVisited((v) => new Set(v).add(to))
    setStep(to)
  }

  const done = [!!draft.name.trim(), !!template, visited.has(2) && step !== 2, !!draft.exposure, visited.has(4) && step !== 4, false]

  return (
    <section className="setup">
      <div className="row between">
        <button className="btn ghost small" onClick={async () => ((step === CAMERA_STEP || (await persist()) || !draft.id) && onClose())}>← All events</button>
        <strong className="setup-title">{draft.name || 'New event'}</strong>
        <span />
      </div>
      <nav className="steps">
        {STEPS.map((label, i) => (
          <button key={label} className={`${i === step ? 'on' : ''} ${done[i] ? 'done' : ''}`} disabled={!draft.id && i > 0} onClick={() => go(i)}>
            <span className="step-num">{done[i] && i !== step ? '✓' : i + 1}</span>{label}
          </button>
        ))}
      </nav>
      {error && <p className="warn">{error}</p>}

      <div className="setup-body">
        {step === 0 && (
          <div className="form narrow">
            <label>Event name<input value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Priya & Tom's Wedding" autoFocus /></label>
            <label>Date<input type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} /></label>
            <h3 className="section-title">Timing</h3>
            <div className="grid2 two">
              <Stepper label="Countdown before the first photo" value={draft.countdownSeconds} min={1} max={10} format={secs} onChange={(v) => set('countdownSeconds', v)} />
              <Stepper label="Countdown between photos" value={draft.shotIntervalSeconds} min={1} max={10} format={secs} onChange={(v) => set('shotIntervalSeconds', v)} />
              <Stepper label="Show each photo for" value={draft.photoReviewSeconds} min={0} max={10} format={(v) => (v === 0 ? "Don't show" : secs(v))}
                hint={draft.photoReviewSeconds === 0 ? 'Photos are not shown, so guests cannot retake.' : 'Guests can retake the photo while it is shown.'}
                onChange={(v) => set('photoReviewSeconds', v)} />
              <Stepper label="Retakes per session" value={draft.retakesAllowed} min={0} max={10} format={(v) => (v === 0 ? 'None' : String(v))} onChange={(v) => set('retakesAllowed', v)} />
              <Stepper label="Final screen stays for" value={draft.doneScreenSeconds} min={5} max={120} step={5} format={secs}
                hint='Then the booth goes back to "Tap to start".' onChange={(v) => set('doneScreenSeconds', v)} />
            </div>
            <h3 className="section-title">Extras</h3>
            <label className="check">
              <input type="checkbox" checked={draft.boomerang} onChange={(e) => set('boomerang', e.target.checked)} />
              Boomerang: after the photos, guests get "3, 2, 1, move!" and a short back-and-forth clip
            </label>
            <p className="muted small">An animated GIF of the photos is always made too. Both are on the guest's QR page and in the booth gallery.</p>
          </div>
        )}

        {step === 1 && (
          <TemplatePicker templates={templates} selected={draft.templateId} onSelect={(id) => set('templateId', id)}
            onImported={async (t) => (await loadTemplates(), set('templateId', t.id))} />
        )}

        {step === 2 && template && <LookStep draft={draft} set={set} template={template} />}

        {step === CAMERA_STEP && draft.id && <CameraSetup devices={devices} event={{ id: draft.id, name: draft.name, exposure: draft.exposure }} />}

        {step === 4 && <PrintStep draft={draft} set={set} template={template} devices={devices} />}

        {step === 5 && draft.id && template && <LaunchStep draft={{ ...draft, id: draft.id }} template={template} devices={devices} onLaunch={onLaunch} />}
      </div>

      {step < STEPS.length - 1 && (
        <div className="row setup-nav">
          {step > 0 && <button className="btn ghost" onClick={() => go(step - 1)}>Back</button>}
          <button className="btn primary" onClick={() => go(step + 1)}>Next: {STEPS[step + 1]}</button>
        </div>
      )}
    </section>
  )
}

function TemplatePicker({ templates, selected, onSelect, onImported }: {
  templates: Template[]
  selected: string
  onSelect: (id: string) => void
  onImported: (t: Template) => void
}) {
  const [editing, setEditing] = useState<Editing | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (editing) return <TemplateEditor initial={editing} onDone={(saved) => (setEditing(null), saved && onImported(saved))} />

  return (
    <div className="templates">
      <DropZone busy={busy} onFile={async (path) => {
        if (!path) return
        setBusy(true)
        try {
          setEditing(await startImport(path))
          setError(null)
        } catch (e) {
          setError(message(e))
        } finally {
          setBusy(false)
        }
      }} />
      {error && <p className="warn">{error}</p>}
      <div className="tpl-grid">
        {templates.map((t) => (
          <button key={t.id} className={`tpl-card pick${t.id === selected ? ' on' : ''}`} onClick={() => onSelect(t.id)}>
            <TemplateThumb id={t.id} />
            <strong>{t.name}</strong>
            <span className="muted small">{describe(t)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function PrintStep({ draft, set, template, devices }: {
  draft: Draft
  set: <K extends keyof Draft>(k: K, v: Draft[K]) => void
  template?: Template
  devices: DeviceSnapshot | null
}) {
  const [status, setStatus] = useState<string | null>(null)
  const printer = devices?.printer
  return (
    <div className="form narrow">
      <label>Copies per session
        <div className="seg">
          {[0, 1, 2, 3, 4].map((n) => (
            <button key={n} className={draft.printCopies === n ? 'on' : ''} onClick={() => set('printCopies', n)}>{n === 0 ? 'No print' : n}</button>
          ))}
        </div>
      </label>
      {template?.format === '2x6' && draft.printCopies > 0 && <p className="muted small">Each copy is one 2×6 strip; strips are printed two to a sheet and cut by the printer.</p>}
      <label className="check"><input type="checkbox" checked={draft.autoPrint} onChange={(e) => set('autoPrint', e.target.checked)} /> Print automatically when a guest finishes</label>
      <label className="check"><input type="checkbox" checked={draft.galleryEnabled} onChange={(e) => set('galleryEnabled', e.target.checked)} /> Show a QR code so guests can download their photos</label>
      <label className="check"><input type="checkbox" checked={draft.showGallery} onChange={(e) => set('showGallery', e.target.checked)} /> Let guests browse this event's photos and GIFs on the booth screen</label>
      {draft.galleryEnabled && !devices?.uploads.enabled && <p className="warn small">The cloud gallery isn't set up on this computer yet, so no QR code will appear. See Devices → Digital delivery.</p>}
      <div className="note">
        <p>Printer: <span className={`pill ${printer?.state === 'ready' ? 'ok' : 'bad'}`}>{printer?.state ?? '…'}</span> {printer?.printerName ?? ''}</p>
        {printer?.message && <p className="muted small">{printer.message}</p>}
      </div>
      {template && (
        <button className="btn" onClick={async () => {
          setStatus('Sending test copy…')
          try {
            await window.booth.testPrintTemplate(template)
            setStatus('Test copy sent to the printer.')
          } catch (e) {
            setStatus(message(e))
          }
        }}>Print test copy of "{template.name}"</button>
      )}
      {status && <p className="muted small">{status}</p>}
    </div>
  )
}

const previewLook = (d: Draft) => ({ look: d.look, skinSmoothing: d.skinSmoothing, backdrop: d.backdrop, backgroundId: d.backgrounds[0]?.id })

/** Green/blue screen: the client's background images for this event. */
function BackgroundsSection({ draft, set }: { draft: Draft; set: <K extends keyof Draft>(k: K, v: Draft[K]) => void }) {
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    for (const b of draft.backgrounds) {
      if (thumbs[b.id]) continue
      window.booth.backgroundImage(b.id, 360).then((src) => setThumbs((t) => ({ ...t, [b.id]: src }))).catch(() => undefined)
    }
  }, [draft.backgrounds]) // eslint-disable-line react-hooks/exhaustive-deps
  const add = async (paths?: string[]) => {
    setError(null)
    try {
      const added = await window.booth.importBackgrounds(paths)
      if (added.length) set('backgrounds', [...draft.backgrounds, ...added])
    } catch (e) {
      setError(message(e))
    }
  }
  return (
    <>
      <h3 className="section-title">Background</h3>
      <div className="seg">
        {(['none', 'green', 'blue'] as const).map((b) => (
          <button key={b} className={draft.backdrop === b ? 'on' : ''} onClick={() => set('backdrop', b)}>
            {{ none: 'Off', green: 'Green screen', blue: 'Blue screen' }[b]}
          </button>
        ))}
      </div>
      {draft.backdrop !== 'none' && (
        <>
          <div
            className="bg-grid"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              void add([...e.dataTransfer.files].map((f) => window.booth.pathForFile(f)))
            }}
          >
            {draft.backgrounds.map((b, i) => (
              <figure key={b.id} className="bg-tile">
                {thumbs[b.id] ? <img src={thumbs[b.id]} alt={b.name} /> : <div className="spinner" />}
                <figcaption className="small">{i === 0 ? `${b.name} (default)` : b.name}</figcaption>
                <button className="close-x" aria-label={`Remove ${b.name}`} onClick={() => set('backgrounds', draft.backgrounds.filter((x) => x.id !== b.id))}>✕</button>
              </figure>
            ))}
            <button className="bg-tile add" onClick={() => add()}>+ Add backgrounds<span className="muted small">or drop images here</span></button>
          </div>
          {!draft.backgrounds.length && <p className="warn small">Add at least one background: the client's artwork, logo wall or scene.</p>}
          <p className="muted small">
            Best at the camera's shape (landscape 3:2, e.g. 3600×2400). It fills the camera frame exactly as guests see it live; layouts with narrower photo windows trim the sides, so keep logos away from the edges (check the preview). With more than one, guests choose on the start screen.
            Light the backdrop evenly and keep guests a step away from it.
          </p>
          {error && <p className="warn small">{error}</p>}
        </>
      )}
    </>
  )
}

function LookStep({ draft, set, template }: {
  draft: Draft
  set: <K extends keyof Draft>(k: K, v: Draft[K]) => void
  template: Template
}) {
  const [preview, setPreview] = useState<string | null>(null)
  useEffect(() => {
    setPreview(null)
    const t = setTimeout(() => {
      window.booth.previewTemplate(template.id, draft.name, previewLook(draft)).then(setPreview).catch(() => undefined)
    }, 250) // the smoothing stepper can be pressed quickly
    return () => clearTimeout(t)
  }, [template.id, draft.name, draft.look, draft.skinSmoothing, draft.backdrop, draft.backgrounds[0]?.id])

  return (
    <div className="launch">
      <div className="form">
        <div className="look-grid">
          {LOOKS.map((l) => (
            <button key={l.id} className={`look-card ${draft.look === l.id ? 'on' : ''}`} onClick={() => set('look', l.id)}>
              <span className="look-swatch" style={{ filter: l.liveView }} />
              <strong>{l.label}</strong>
              <span className="muted small">{l.description}</span>
            </button>
          ))}
        </div>
        {draft.look === 'glam' && (
          <Stepper label="Skin smoothing" value={draft.skinSmoothing} min={0} max={100} step={10}
            format={(v) => (v === 0 ? 'Off' : v <= 30 ? `Light (${v})` : v <= 60 ? `Medium (${v})` : `Strong (${v})`)}
            hint="Softens skin; eyes, hair and outlines stay sharp." onChange={(v) => set('skinSmoothing', v)} />
        )}
        {draft.look !== 'colour' && (
          <label className="check">
            <input type="checkbox" checked={draft.colourCopy} onChange={(e) => set('colourCopy', e.target.checked)} />
            Also keep a colour version, so guests can have both (prints stay {lookInfo(draft.look).label})
          </label>
        )}
        <BackgroundsSection draft={draft} set={set} />
        <p className="muted small">The live camera view on the booth screen shows the look too, so guests pose for it. Your original photos are always kept in full colour.</p>
      </div>
      <div className="preview-pane">{preview ? <img src={preview} alt={`${lookInfo(draft.look).label} preview`} /> : <div className="spinner" />}</div>
    </div>
  )
}

function LaunchStep({ draft, template, devices, onLaunch }: {
  draft: Draft & { id: string }
  template: Template
  devices: DeviceSnapshot | null
  onLaunch: (id: string) => void
}) {
  const [preview, setPreview] = useState<string | null>(null)
  useEffect(() => {
    window.booth.previewTemplate(template.id, draft.name, previewLook(draft)).then(setPreview).catch(() => undefined)
  }, [template.id, draft.name, draft.look, draft.skinSmoothing, draft.backdrop, draft.backgrounds[0]?.id])

  const cam = devices?.camera
  const printer = devices?.printer
  const checks: { ok: boolean | 'warn'; label: string; detail: string }[] = [
    { ok: true, label: 'Event', detail: `${draft.name} · ${formatEventDate(draft.date, { day: 'numeric', month: 'long' })}` },
    { ok: true, label: 'Template', detail: `${template.name} · ${describe(template)}` },
    { ok: true, label: 'Look', detail: `${lookInfo(draft.look).label}${draft.look === 'glam' ? ` · skin smoothing ${draft.skinSmoothing}` : ''}${draft.look !== 'colour' && draft.colourCopy ? ' · plus colour copy' : ''}` },
    { ok: cam?.state === 'ready', label: 'Camera', detail: cam?.state === 'ready' ? (cam.model ?? 'Connected') : (cam?.message ?? 'Not connected') },
    { ok: draft.exposure ? true : 'warn', label: 'Exposure', detail: draft.exposure ? describeExposure(draft.exposure) : "Not set: the camera's own settings will be used" },
    { ok: draft.printCopies === 0 || printer?.state === 'ready', label: 'Printer', detail: draft.printCopies === 0 ? 'Printing off' : `${printer?.state ?? '…'}${printer?.queueLength ? ` · ${printer.queueLength} waiting` : ''} · ${draft.printCopies} cop${draft.printCopies === 1 ? 'y' : 'ies'}${draft.autoPrint ? ', automatic' : ''}` },
    { ok: !draft.galleryEnabled || devices?.uploads.enabled ? true : 'warn', label: 'QR download', detail: !draft.galleryEnabled ? 'Off' : devices?.uploads.enabled ? 'On' : 'On, but the cloud gallery is not set up' }
  ]
  const blocking = checks.some((c) => c.ok === false)

  return (
    <div className="launch">
      <div className="launch-checks">
        {checks.map((c) => (
          <div key={c.label} className={`check-row ${c.ok === true ? 'ok' : c.ok === 'warn' ? 'warn' : 'bad'}`}>
            <span className="check-icon">{c.ok === true ? '✓' : c.ok === 'warn' ? '!' : '✕'}</span>
            <div><strong>{c.label}</strong><div className="muted small">{c.detail}</div></div>
          </div>
        ))}
        <button className="btn primary huge" onClick={() => onLaunch(draft.id)}>▶ Launch event</button>
        {blocking && <p className="warn small">Something above isn't ready. You can still launch, but guests may hit errors until it's fixed.</p>}
      </div>
      <div className="preview-pane">{preview ? <img src={preview} alt="Print preview" /> : <div className="spinner" />}</div>
    </div>
  )
}
