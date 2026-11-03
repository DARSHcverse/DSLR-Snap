import { useEffect, useRef, useState } from 'react'
import { canvasSize, SAFE_MARGIN, validateTemplate } from '@shared/layout'
import { centreX, defaultQr, FONTS, MAX_TEXTS, newText, spaceEvenly } from '@shared/templateEdit'
import { BUILT_IN_TEMPLATES } from '@shared/templates'
import type { FitMode, PrintFormat, Orientation, Rect, Template, TemplateImportDraft, TextItem } from '@shared/types'

const BUILT_IN_IDS = new Set(BUILT_IN_TEMPLATES.map((t) => t.id))
export const isBuiltIn = (t: Template) => BUILT_IN_IDS.has(t.id)
export const describe = (t: Template) => `${t.format === '2x6' ? '2×6 strip' : `4×6 ${t.orientation}`} · ${t.slots.length} photo${t.slots.length === 1 ? '' : 's'}`
/** IPC errors arrive wrapped ("Error invoking remote method …"); operators only need the message. */
export const message = (e: unknown) => String(e instanceof Error ? e.message : e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

export interface Editing {
  template: Template
  artwork: string
  /** Present while importing; lets the operator change format and fit before saving. */
  draft?: TemplateImportDraft & { srcPath: string }
}

/**
 * Editor state for a saved template. Imported designs bring their artwork; drawn templates (the
 * built-ins and copies of them) have none and are edited on their background colour.
 */
export async function openForEdit(t: Template): Promise<Editing> {
  const artwork = await window.booth.getTemplateArtwork(t.id)
  if (!artwork && t.id.startsWith('imported-')) throw new Error(`The design file for "${t.name}" is missing. Import it again.`)
  return { template: t, artwork: artwork ?? '' }
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
    try {
      setEditing(await openForEdit(t))
    } catch (e) {
      setError(message(e))
    }
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
              <div className="muted small">{describe(t)}{isBuiltIn(t) ? ' · built-in' : ''}</div>
            </div>
            <div className="row">
              <button className="btn small" onClick={() => edit(t)}>{isBuiltIn(t) ? 'Duplicate & edit' : 'Edit'}</button>
              {!isBuiltIn(t) && (
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
              )}
            </div>
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

/** What's selected on the canvas: a photo box, a line of text or the QR square. */
type Sel = { kind: 'slot' | 'text'; i: number } | { kind: 'qr' } | null

/** Quick text buttons: tokens are filled in on every print. */
const QUICK_TEXT = [
  { label: 'Event name', text: '{event}' },
  { label: 'Date', text: '{date}' },
  { label: 'Time', text: '{time}' },
  { label: '#Hashtag', text: '#YourHashtag' }
]

export function TemplateEditor({ initial, onDone }: { initial: Editing; onDone: (saved?: Template) => void }) {
  const [t, setTemplate] = useState(initial.template)
  const [artwork, setArtwork] = useState(initial.artwork)
  const [draft, setDraft] = useState(initial.draft)
  const [sel, setSel] = useState<Sel>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [users, setUsers] = useState<string[]>([])
  const [safeArea, setSafeArea] = useState(true)
  // Undo/redo: a snapshot is taken before each change (and once at the start of a drag).
  const [history, setHistory] = useState<{ past: Template[]; future: Template[] }>({ past: [], future: [] })
  const size = canvasSize(t.format, t.orientation)
  const issues = validateTemplate(t)
  const builtIn = isBuiltIn(initial.template)
  useEffect(() => {
    if (!draft && !builtIn) window.booth.templateUsers(initial.template.id).then(setUsers).catch(() => setUsers([]))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const snapshot = () => setHistory((h) => ({ past: [...h.past.slice(-49), t], future: [] }))
  /** A change worth undoing on its own (buttons, fields). */
  const change = (next: Template | ((cur: Template) => Template)) => {
    snapshot()
    setTemplate(next)
  }
  const undo = () => {
    const prev = history.past.at(-1)
    if (!prev) return
    setHistory({ past: history.past.slice(0, -1), future: [t, ...history.future] })
    setTemplate(prev)
    setSel(null)
  }
  const redo = () => {
    const next = history.future[0]
    if (!next) return
    setHistory({ past: [...history.past, t], future: history.future.slice(1) })
    setTemplate(next)
    setSel(null)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) (e.preventDefault(), undo())
      else if (k === 'y' || (k === 'z' && e.shiftKey)) (e.preventDefault(), redo())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

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
      const next = await window.booth.prepareTemplateImport(draft.srcPath, { draftId: t.id, format: t.format, orientation: t.format === '2x6' ? 'portrait' : t.orientation, fit: draft.fit, ...opts })
      change({ ...next.template, name: t.name, texts: t.texts })
      setArtwork(next.artwork)
      setDraft({ ...next, srcPath: draft.srcPath })
      setSel(null)
    })

  // Moves from the canvas (drag, arrow keys): the canvas takes the snapshot at the start of a drag.
  const moveSlot = (i: number, r: Rect) => setTemplate((cur) => ({ ...cur, slots: cur.slots.map((s, j) => (j === i ? r : s)) }))
  const moveText = (i: number, x: number, y: number) => setTemplate((cur) => ({ ...cur, texts: cur.texts.map((x0, j) => (j === i ? { ...x0, x: Math.round(x), y: Math.round(y) } : x0)) }))
  const moveQr = (r: Rect) => setTemplate((cur) => ({ ...cur, qr: r }))
  const setText = (i: number, patch: Partial<TextItem>) => change((cur) => ({ ...cur, texts: cur.texts.map((x, j) => (j === i ? { ...x, ...patch } : x)) }))

  const addSlot = () => {
    const last = t.slots[t.slots.length - 1]
    const w = last?.w ?? Math.round(size.w * 0.8)
    const h = last?.h ?? Math.round(size.w * 0.6)
    change({ ...t, slots: [...t.slots, clamp({ x: (size.w - w) / 2, y: (size.h - h) / 2, w, h }, size)] })
    setSel({ kind: 'slot', i: t.slots.length })
  }
  const addText = (text: string) => {
    change({ ...t, texts: [...t.texts, newText(size, text, t.texts)] })
    setSel({ kind: 'text', i: t.texts.length })
  }
  const removeSelected = () => {
    if (!sel) return
    if (sel.kind === 'slot') change({ ...t, slots: t.slots.filter((_, j) => j !== sel.i) })
    else if (sel.kind === 'text') change({ ...t, texts: t.texts.filter((_, j) => j !== sel.i) })
    else change({ ...t, qr: undefined })
    setSel(null)
  }
  const centreSelected = () => {
    if (!sel) return
    if (sel.kind === 'slot') change({ ...t, slots: t.slots.map((s, j) => (j === sel.i ? centreX(s, size) : s)) })
    else if (sel.kind === 'text') setText(sel.i, { x: Math.round(size.w / 2), align: 'middle' })
    else if (t.qr) change({ ...t, qr: centreX(t.qr, size) })
  }
  const matchSizes = () => change({ ...t, slots: t.slots.map((s) => clamp({ ...s, w: t.slots[0].w, h: t.slots[0].h }, size)) })
  const toggleQr = (on: boolean) => {
    change({ ...t, qr: on ? defaultQr(size) : undefined })
    setSel(on ? { kind: 'qr' } : null)
  }

  const cancel = async () => {
    if (draft) await window.booth.discardTemplateDraft(t.id)
    onDone()
  }

  const text = sel?.kind === 'text' ? t.texts[sel.i] : undefined
  const selLabel = !sel ? null : sel.kind === 'slot' ? `photo ${sel.i + 1}` : sel.kind === 'text' ? 'text' : 'QR code'

  return (
    <section className="tpl-editor">
      <div className="tpl-stage">
        <div className="tpl-toolbar">
          <button className="btn small ghost" disabled={!history.past.length} onClick={undo} title="Undo (Ctrl+Z)">↶ Undo</button>
          <button className="btn small ghost" disabled={!history.future.length} onClick={redo} title="Redo (Ctrl+Y)">↷ Redo</button>
          <label className="check small"><input type="checkbox" checked={safeArea} onChange={(e) => setSafeArea(e.target.checked)} /> Show safe area</label>
        </div>
        <SlotCanvas template={t} artwork={artwork} sel={sel} safeArea={safeArea} onSelect={setSel} onDragStart={snapshot}
          onSlot={moveSlot} onText={moveText} onQr={moveQr} onDelete={removeSelected} />
        {safeArea && <p className="muted small">Keep names and faces inside the dashed line: the printer may trim the edges{t.format === '2x6' ? ', and each strip is cut along its long edges' : ''}.</p>}
      </div>
      <div className="form">
        <h2>{draft ? 'Import design' : builtIn ? 'Duplicate & edit' : 'Edit template'}</h2>
        {builtIn && <p className="muted small">Built-in templates stay as they are; your changes are saved as your own copy.</p>}
        {users.length > 0 && (
          <div className="note"><p className="small">Used by {users.length === 1 ? 'the event' : `${users.length} events`} <strong>{users.slice(0, 3).join(', ')}{users.length > 3 ? '…' : ''}</strong>. Saving changes {users.length === 1 ? 'it' : 'all of them'}; use <strong>Save as a copy</strong> to leave {users.length === 1 ? 'it' : 'them'} unchanged.</p></div>
        )}
        <label>Template name<input value={t.name} onChange={(e) => setTemplate({ ...t, name: e.target.value })} /></label>
        {!artwork && (
          <label className="row-label">Background colour
            <input type="color" value={t.background} onChange={(e) => change({ ...t, background: e.target.value })} />
          </label>
        )}

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
            <button className="btn small ghost" disabled={t.slots.length < 2} onClick={matchSizes}>Make all same size as 1</button>
            <button className="btn small ghost" disabled={t.slots.length < 3} onClick={() => change({ ...t, slots: spaceEvenly(t.slots) })} title="Equal gaps between the photos, top to bottom">Space evenly</button>
          </div>
        </div>

        <div className="field">
          <span className="field-label">Text on the print</span>
          <div className="row">
            {QUICK_TEXT.map((q) => <button key={q.label} className="btn small" disabled={t.texts.length >= MAX_TEXTS} onClick={() => addText(q.text)}>+ {q.label}</button>)}
          </div>
          {text && sel?.kind === 'text' && (
            <div className="tpl-textbox">
              <input value={text.text} maxLength={80} onFocus={snapshot} onChange={(e) => setTemplate((cur) => ({ ...cur, texts: cur.texts.map((x, j) => (j === sel.i ? { ...x, text: e.target.value } : x)) }))} />
              <span className="muted small">{'{event}'}, {'{date}'} and {'{time}'} are filled in on every print.</span>
              <div className="row">
                <select value={text.fontFamily ?? FONTS[0].family} onChange={(e) => setText(sel.i, { fontFamily: e.target.value })} aria-label="Font">
                  {FONTS.map((f) => <option key={f.id} value={f.family}>{f.label}</option>)}
                </select>
                <input type="color" value={text.color} onChange={(e) => setText(sel.i, { color: e.target.value })} aria-label="Text colour" />
                <button className={`btn small ${text.weight === 'bold' ? 'primary' : 'ghost'}`} onClick={() => setText(sel.i, { weight: text.weight === 'bold' ? 'normal' : 'bold' })} aria-pressed={text.weight === 'bold'}><strong>B</strong></button>
                <div className="seg small">
                  {(['start', 'middle', 'end'] as const).map((a) => (
                    <button key={a} className={(text.align ?? 'start') === a ? 'on' : ''} onClick={() => setText(sel.i, { align: a })} aria-label={`Align ${a === 'start' ? 'left' : a === 'end' ? 'right' : 'centre'}`}>{a === 'start' ? '⇤' : a === 'end' ? '⇥' : '↔'}</button>
                  ))}
                </div>
              </div>
              <label className="row-label">Size
                <input type="range" min={14} max={160} value={text.size} onPointerDown={snapshot} onChange={(e) => setTemplate((cur) => ({ ...cur, texts: cur.texts.map((x, j) => (j === sel.i ? { ...x, size: Number(e.target.value) } : x)) }))} />
              </label>
            </div>
          )}
          {!text && <span className="muted small">Add text, then drag it into place. Click text on the design to change it.</span>}
        </div>

        <div className="field">
          <label className="check"><input type="checkbox" checked={!!t.qr} onChange={(e) => toggleQr(e.target.checked)} /> Print each guest&apos;s QR code</label>
          <span className="muted small">Guests scan it on the print to download their photos. Needs QR downloads on for the event; drag the square where it fits.</span>
        </div>

        {sel && (
          <div className="row">
            <span className="muted small">Selected: {selLabel}</span>
            <button className="btn small ghost" onClick={centreSelected}>Centre</button>
            <button className="btn small ghost danger" onClick={removeSelected}>Remove {selLabel}</button>
          </div>
        )}
        <span className="muted small">Drag to move, drag a corner to resize. Arrow keys nudge (Shift for bigger steps); Delete removes.</span>

        {issues.map((i) => <p key={i.message} className={i.level === 'error' ? 'warn small' : 'muted small'}>{i.level === 'error' ? '✕ ' : '⚠ '}{i.message}</p>)}
        {status && <p className="muted small">{status}</p>}
        {error && <p className="warn">{error}</p>}

        <div className="row">
          <button className="btn" disabled={busy || !t.slots.length} onClick={() => run(async () => setPreview(await window.booth.previewTemplateDraft(t, 'Your Event')))}>Preview</button>
          <button className="btn ghost" disabled={busy || !t.slots.length} onClick={() => run(async () => {
            await window.booth.testPrintTemplate(t)
            setStatus('Test copy sent to the printer.')
          })}>Print test copy</button>
        </div>
        <span className="muted small">Previews use your latest camera test shots when there are any.</span>
        <div className="row">
          <button className="btn primary" disabled={busy || issues.some((i) => i.level === 'error') || !t.name.trim()} onClick={() => run(async () => {
            onDone(await window.booth.saveTemplate(t))
          })}>{builtIn ? 'Save as my copy' : 'Save template'}</button>
          {!draft && !builtIn && (
            <button className="btn" disabled={busy || issues.some((i) => i.level === 'error') || !t.name.trim()} onClick={() => run(async () => {
              onDone(await window.booth.saveTemplate(t, { asCopy: true }))
            })}>Save as a copy</button>
          )}
          <button className="btn ghost" onClick={cancel}>Cancel</button>
        </div>
      </div>

      {preview && (
        <div className="modal" onClick={() => setPreview(null)}>
          <img src={preview} alt="Preview" />
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

/** The square QR keeps its shape when resized. */
const clampSquare = (r: Rect, c: { w: number; h: number }) => {
  const side = Math.round(Math.min(Math.max(Math.max(r.w, r.h), 120), c.w, c.h))
  return clamp({ ...r, w: side, h: side }, c)
}

function SlotCanvas({ template, artwork, sel, safeArea, onSelect, onDragStart, onSlot, onText, onQr, onDelete }: {
  template: Template
  artwork: string
  sel: Sel
  safeArea: boolean
  onSelect: (s: Sel) => void
  onDragStart: () => void
  onSlot: (i: number, r: Rect) => void
  onText: (i: number, x: number, y: number) => void
  onQr: (r: Rect) => void
  onDelete: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const size = canvasSize(template.format, template.orientation)
  const pct = (v: number, of: number) => `${(v / of) * 100}%`

  const drag = (e: React.PointerEvent, target: NonNullable<Sel>, mode: 'move' | 'resize') => {
    e.preventDefault()
    e.stopPropagation()
    onSelect(target)
    onDragStart()
    ref.current?.focus()
    const scale = size.w / ref.current!.getBoundingClientRect().width
    const start = { x: e.clientX, y: e.clientY }
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const startSlot = target.kind === 'slot' ? template.slots[target.i] : undefined
    const startText = target.kind === 'text' ? template.texts[target.i] : undefined
    const startQr = template.qr
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - start.x) * scale
      const dy = (ev.clientY - start.y) * scale
      if (startSlot && target.kind === 'slot') {
        const s = startSlot
        if (mode === 'move') onSlot(target.i, clamp({ ...s, x: s.x + dx, y: s.y + dy }, size))
        // Resizing grows from the top-left corner, so keep the box inside the canvas on the right/bottom.
        else onSlot(target.i, clamp({ ...s, w: Math.min(s.w + dx, size.w - s.x), h: Math.min(s.h + dy, size.h - s.y) }, size))
      } else if (startText && target.kind === 'text') {
        onText(target.i, Math.min(size.w, Math.max(0, startText.x + dx)), Math.min(size.h, Math.max(0, startText.y + dy)))
      } else if (startQr && target.kind === 'qr') {
        const q = startQr
        onQr(mode === 'move' ? clampSquare({ ...q, x: q.x + dx, y: q.y + dy }, size) : clampSquare({ ...q, w: q.w + Math.max(dx, dy), h: q.h + Math.max(dx, dy) }, size))
      }
    }
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (!sel) return
    if (e.key === 'Delete' || e.key === 'Backspace') return (e.preventDefault(), onDelete())
    const step = e.shiftKey ? 10 : 1
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
    if (!d) return
    e.preventDefault()
    if (!e.repeat) onDragStart()
    if (sel.kind === 'slot') {
      const s = template.slots[sel.i]
      onSlot(sel.i, clamp({ ...s, x: s.x + d[0], y: s.y + d[1] }, size))
    } else if (sel.kind === 'text') {
      const x = template.texts[sel.i]
      onText(sel.i, x.x + d[0], x.y + d[1])
    } else if (template.qr) {
      onQr(clampSquare({ ...template.qr, x: template.qr.x + d[0], y: template.qr.y + d[1] }, size))
    }
  }

  return (
    <div
      ref={ref}
      tabIndex={0}
      className={`tpl-canvas ${template.orientation === 'landscape' ? 'wide' : 'tall'}`}
      style={{ aspectRatio: `${size.w} / ${size.h}`, background: template.background }}
      onPointerDown={() => onSelect(null)}
      onKeyDown={onKey}
    >
      {artwork && <img src={artwork} alt="" draggable={false} />}
      {template.slots.map((s, i) => (
        <div key={i} className={`tpl-slot${sel?.kind === 'slot' && sel.i === i ? ' sel' : ''}`}
          style={{ left: pct(s.x, size.w), top: pct(s.y, size.h), width: pct(s.w, size.w), height: pct(s.h, size.h) }}
          onPointerDown={(e) => drag(e, { kind: 'slot', i }, 'move')}>
          <span>{i + 1}</span>
          <i className="tpl-handle" onPointerDown={(e) => drag(e, { kind: 'slot', i }, 'resize')} />
        </div>
      ))}
      {template.qr && (
        <div className={`tpl-qr${sel?.kind === 'qr' ? ' sel' : ''}`}
          style={{ left: pct(template.qr.x, size.w), top: pct(template.qr.y, size.h), width: pct(template.qr.w, size.w), height: pct(template.qr.h, size.h) }}
          onPointerDown={(e) => drag(e, { kind: 'qr' }, 'move')}>
          <span>QR</span>
          <i className="tpl-handle" onPointerDown={(e) => drag(e, { kind: 'qr' }, 'resize')} />
        </div>
      )}
      {template.texts.map((x, i) => (
        // SVG text sits on its baseline at (x, y); this approximates it. Preview shows the exact print.
        <div key={i} className={`tpl-text${sel?.kind === 'text' && sel.i === i ? ' sel' : ''}`}
          style={{
            left: pct(x.x, size.w), top: pct(x.y, size.h), color: x.color, fontFamily: x.fontFamily, fontWeight: x.weight === 'bold' ? 700 : 400,
            fontSize: `${(x.size / size.w) * 100}cqw`,
            transform: `translate(${x.align === 'middle' ? '-50%' : x.align === 'end' ? '-100%' : '0'}, -82%)`
          }}
          onPointerDown={(e) => drag(e, { kind: 'text', i }, 'move')}>
          {x.text.replaceAll('{event}', 'Your Event').replaceAll('{date}', new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })).replaceAll('{time}', '20:15')}
        </div>
      ))}
      {safeArea && <div className="tpl-safe" style={{ inset: `${pct(SAFE_MARGIN, size.h)} ${pct(SAFE_MARGIN, size.w)}` }} />}
    </div>
  )
}
