import { useEffect, useRef, useState } from 'react'
import { canvasSize, validateTemplate } from '@shared/layout'
import type { FitMode, PrintFormat, Orientation, Rect, Template, TemplateImportDraft } from '@shared/types'

const isImported = (t: Template) => t.id.startsWith('imported-')
export const describe = (t: Template) => `${t.format === '2x6' ? '2×6 strip' : `4×6 ${t.orientation}`} · ${t.slots.length} photo${t.slots.length === 1 ? '' : 's'}`
/** IPC errors arrive wrapped ("Error invoking remote method …"); operators only need the message. */
export const message = (e: unknown) => String(e instanceof Error ? e.message : e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

export interface Editing {
  template: Template
  artwork: string
  /** Present while importing; lets the operator change format and fit before saving. */
  draft?: TemplateImportDraft & { srcPath: string }
}

/** Reads a dropped/chosen design and returns editor state for it. */
export async function startImport(srcPath: string): Promise<Editing> {
  const draft = await window.booth.prepareTemplateImport(srcPath)
  return { template: draft.template, artwork: draft.artwork, draft: { ...draft, srcPath } }
}

export default function TemplatesTab() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [editing, setEditing] = useState<Editing | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => setTemplates(await window.booth.listTemplates())
  useEffect(() => void load(), [])

  const importFile = async (srcPath: string | null) => {
    if (!srcPath) return
    setBusy(true)
    setError(null)
    try {
      setEditing(await startImport(srcPath))
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }

  const edit = async (t: Template) => {
    const artwork = await window.booth.getTemplateArtwork(t.id)
    if (!artwork) return setError(`The design file for "${t.name}" is missing. Import it again.`)
    setEditing({ template: t, artwork })
  }

  if (editing) {
    return <TemplateEditor initial={editing} onDone={async () => (setEditing(null), await load())} />
  }

  return (
    <section className="templates">
      <h2>Templates</h2>
      <DropZone busy={busy} onFile={importFile} />
      {error && <p className="warn">{error}</p>}
      <div className="tpl-grid">
        {templates.map((t) => (
          <div key={t.id} className="tpl-card">
            <TemplateThumb id={t.id} />
            <div>
              <strong>{t.name}</strong>
              <div className="muted small">{describe(t)}{isImported(t) ? '' : ' · built-in'}</div>
            </div>
            {isImported(t) && (
              <div className="row">
                <button className="btn small" onClick={() => edit(t)}>Edit</button>
                <button className="btn small ghost danger" onClick={async () => {
                  if (!confirm(`Delete the template "${t.name}"?`)) return
                  try {
                    await window.booth.deleteTemplate(t.id)
                    setError(null)
                    await load()
                  } catch (e) {
                    setError(message(e))
                  }
                }}>Delete</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

export function DropZone({ busy, onFile }: { busy: boolean; onFile: (path: string | null) => void }) {
  const [over, setOver] = useState(false)
  return (
    <div
      className={`dropzone${over ? ' over' : ''}`}
      onDragOver={(e) => (e.preventDefault(), setOver(true))}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const file = e.dataTransfer.files[0]
        if (file) onFile(window.booth.pathForFile(file))
      }}
    >
      {busy ? <div className="spinner" /> : (
        <>
          <strong>Drop your design here</strong>
          <p className="muted small">PNG or JPG from Canva, ChatGPT or Photoshop. See-through photo windows are found automatically.</p>
          <button className="btn primary" onClick={async () => onFile(await window.booth.chooseTemplateFile())}>Choose file…</button>
        </>
      )}
    </div>
  )
}

export function TemplateThumb({ id }: { id: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    window.booth.previewTemplate(id, '').then(setSrc).catch(() => undefined)
  }, [id])
  return <div className="tpl-thumb">{src ? <img src={src} alt="" /> : <div className="spinner" />}</div>
}

const LAYOUTS: { label: string; format: PrintFormat; orientation: Orientation }[] = [
  { label: '2×6 strip', format: '2x6', orientation: 'portrait' },
  { label: '4×6 portrait', format: '4x6', orientation: 'portrait' },
  { label: '4×6 landscape', format: '4x6', orientation: 'landscape' }
]

const FITS: { value: FitMode; label: string; help: string }[] = [
  { value: 'stretch', label: 'Stretch', help: 'Fills the page exactly. Best when the design is already the right shape.' },
  { value: 'fit', label: 'Fit inside', help: 'Nothing is cut off or squashed; borders are added in the design’s colour.' },
  { value: 'fill', label: 'Fill & crop', help: 'Fills the page without squashing; the edges of the design are cut off.' }
]

const DETECTION = {
  transparent: (n: number) => `Found ${n} see-through photo window${n === 1 ? '' : 's'}.`,
  placeholder: (n: number) => `Found ${n} photo box${n === 1 ? '' : 'es'} in your design. Check they line up.`,
  none: () => 'No photo areas found. Drag the numbered boxes onto your design.'
}

export function TemplateEditor({ initial, onDone }: { initial: Editing; onDone: (saved?: Template) => void }) {
  const [t, setT] = useState(initial.template)
  const [artwork, setArtwork] = useState(initial.artwork)
  const [draft, setDraft] = useState(initial.draft)
  const [selected, setSelected] = useState<number | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const size = canvasSize(t.format, t.orientation)
  const issues = validateTemplate(t)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }

  const reimport = (opts: { format?: PrintFormat; orientation?: Orientation; fit?: FitMode }) =>
    run(async () => {
      if (!draft) return
      const next = await window.booth.prepareTemplateImport(draft.srcPath, { draftId: t.id, format: t.format, orientation: t.orientation, fit: draft.fit, ...opts })
      setT({ ...next.template, name: t.name })
      setArtwork(next.artwork)
      setDraft({ ...next, srcPath: draft.srcPath })
      setSelected(null)
    })

  const setSlot = (i: number, r: Rect) => setT((cur) => ({ ...cur, slots: cur.slots.map((s, j) => (j === i ? r : s)) }))
  const addSlot = () => {
    const last = t.slots[t.slots.length - 1]
    const w = last?.w ?? Math.round(size.w * 0.8)
    const h = last?.h ?? Math.round(size.w * 0.6)
    setT({ ...t, slots: [...t.slots, clamp({ x: (size.w - w) / 2, y: (size.h - h) / 2, w, h }, size)] })
    setSelected(t.slots.length)
  }
  const removeSlot = () => {
    if (selected === null) return
    setT({ ...t, slots: t.slots.filter((_, j) => j !== selected) })
    setSelected(null)
  }
  const matchSizes = () => setT({ ...t, slots: t.slots.map((s) => clamp({ ...s, w: t.slots[0].w, h: t.slots[0].h }, size)) })

  const cancel = async () => {
    if (draft) await window.booth.discardTemplateDraft(t.id)
    onDone()
  }

  return (
    <section className="tpl-editor">
      <div className="tpl-stage">
        <SlotCanvas template={t} artwork={artwork} selected={selected} onSelect={setSelected} onChange={setSlot} />
      </div>
      <div className="form">
        <h2>{draft ? 'Import design' : 'Edit template'}</h2>
        <label>Template name<input value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} /></label>

        {draft && (
          <>
            <div className="field">
              <span className="field-label">Print as</span>
              <div className="seg">
                {LAYOUTS.map((l) => (
                  <button key={l.label} disabled={busy} className={t.format === l.format && t.orientation === l.orientation ? 'on' : ''}
                    onClick={() => reimport({ format: l.format, orientation: l.orientation, fit: undefined })}>{l.label}</button>
                ))}
              </div>
              {t.format === '2x6' && <span className="muted small">Printed two to a 4×6 sheet and cut by the printer.</span>}
            </div>
            <div className="field">
              <span className="field-label">Fit to page</span>
              <div className="seg">
                {FITS.map((f) => (
                  <button key={f.value} disabled={busy} className={draft.fit === f.value ? 'on' : ''} onClick={() => reimport({ fit: f.value })}>{f.label}</button>
                ))}
              </div>
              <span className="muted small">{FITS.find((f) => f.value === draft.fit)?.help}</span>
            </div>
            <div className="note">
              <p>{DETECTION[draft.detection](draft.template.slots.length)}</p>
              <p className="muted small">{t.overlayPath ? 'Your design sits on top of the photos.' : 'The photos sit on top of your design.'}</p>
              {draft.notes.map((n) => <p key={n} className="warn small">{n}</p>)}
            </div>
          </>
        )}

        <div className="field">
          <span className="field-label">Photos · {t.slots.length} per session</span>
          <div className="row">
            <button className="btn small" disabled={t.slots.length >= 8} onClick={addSlot}>+ Add photo</button>
            <button className="btn small ghost" disabled={selected === null} onClick={removeSlot}>Remove {selected === null ? 'photo' : `photo ${selected + 1}`}</button>
            <button className="btn small ghost" disabled={t.slots.length < 2} onClick={matchSizes}>Make all same size as 1</button>
          </div>
          <span className="muted small">Drag a box to move it, drag its corner to resize. Arrow keys nudge (hold Shift for bigger steps).</span>
        </div>

        {issues.map((i) => <p key={i.message} className={i.level === 'error' ? 'warn small' : 'muted small'}>{i.level === 'error' ? '✕ ' : '⚠ '}{i.message}</p>)}
        {status && <p className="muted small">{status}</p>}
        {error && <p className="warn">{error}</p>}

        <div className="row">
          <button className="btn" disabled={busy || !t.slots.length} onClick={() => run(async () => setPreview(await window.booth.previewTemplateDraft(t, 'Your Event')))}>Preview with sample photos</button>
          <button className="btn ghost" disabled={busy || !t.slots.length} onClick={() => run(async () => {
            await window.booth.testPrintTemplate(t)
            setStatus('Test copy sent to the printer.')
          })}>Print test copy</button>
        </div>
        <div className="row">
          <button className="btn primary" disabled={busy || issues.some((i) => i.level === 'error') || !t.name.trim()} onClick={() => run(async () => {
            onDone(await window.booth.saveTemplate(t))
          })}>Save template</button>
          <button className="btn ghost" onClick={cancel}>Cancel</button>
        </div>
      </div>

      {preview && (
        <div className="modal" onClick={() => setPreview(null)}>
          <img src={preview} alt="Preview with sample photos" />
          <button className="btn">Close</button>
        </div>
      )}
    </section>
  )
}

const MIN_SLOT = 60

function clamp(r: Rect, c: { w: number; h: number }): Rect {
  const w = Math.round(Math.min(Math.max(r.w, MIN_SLOT), c.w))
  const h = Math.round(Math.min(Math.max(r.h, MIN_SLOT), c.h))
  return { x: Math.round(Math.min(Math.max(r.x, 0), c.w - w)), y: Math.round(Math.min(Math.max(r.y, 0), c.h - h)), w, h }
}

function SlotCanvas({ template, artwork, selected, onSelect, onChange }: {
  template: Template
  artwork: string
  selected: number | null
  onSelect: (i: number | null) => void
  onChange: (i: number, r: Rect) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const size = canvasSize(template.format, template.orientation)
  const pct = (v: number, of: number) => `${(v / of) * 100}%`

  const drag = (e: React.PointerEvent, i: number, mode: 'move' | 'resize') => {
    e.preventDefault()
    e.stopPropagation()
    onSelect(i)
    ref.current?.focus()
    const scale = size.w / ref.current!.getBoundingClientRect().width
    const start = { x: e.clientX, y: e.clientY, slot: template.slots[i] }
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - start.x) * scale
      const dy = (ev.clientY - start.y) * scale
      const s = start.slot
      if (mode === 'move') onChange(i, clamp({ ...s, x: s.x + dx, y: s.y + dy }, size))
      // Resizing grows from the top-left corner, so keep the box inside the canvas on the right/bottom.
      else onChange(i, clamp({ ...s, w: Math.min(s.w + dx, size.w - s.x), h: Math.min(s.h + dy, size.h - s.y) }, size))
    }
    const up = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
      target.removeEventListener('pointercancel', up)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
    target.addEventListener('pointercancel', up)
  }

  const nudge = (e: React.KeyboardEvent) => {
    if (selected === null) return
    const step = e.shiftKey ? 10 : 1
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
    if (!d) return
    e.preventDefault()
    const s = template.slots[selected]
    onChange(selected, clamp({ ...s, x: s.x + d[0], y: s.y + d[1] }, size))
  }

  return (
    <div
      ref={ref}
      tabIndex={0}
      className={`tpl-canvas ${template.orientation === 'landscape' ? 'wide' : 'tall'}`}
      style={{ aspectRatio: `${size.w} / ${size.h}` }}
      onPointerDown={() => onSelect(null)}
      onKeyDown={nudge}
    >
      <img src={artwork} alt="" draggable={false} />
      {template.slots.map((s, i) => (
        <div key={i} className={`tpl-slot${selected === i ? ' sel' : ''}`}
          style={{ left: pct(s.x, size.w), top: pct(s.y, size.h), width: pct(s.w, size.w), height: pct(s.h, size.h) }}
          onPointerDown={(e) => drag(e, i, 'move')}>
          <span>{i + 1}</span>
          <i className="tpl-handle" onPointerDown={(e) => drag(e, i, 'resize')} />
        </div>
      ))}
    </div>
  )
}
