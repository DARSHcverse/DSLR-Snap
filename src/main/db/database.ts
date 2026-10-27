import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { todayIso } from '../../shared/dates'
import { LOOKS } from '../../shared/looks'
import { BUILT_IN_TEMPLATES } from '../../shared/templates'
import type {
  PaperState,
  BoothEvent,
  DeviceSettings,
  EventInput,
  EventStats,
  ExposureSettings,
  PrintFormat,
  PrintJob,
  PrintJobStatus,
  SessionRecord,
  SessionStatus,
  Template,
  UploadJob,
  UploadStatus
} from '../../shared/types'

const MIGRATIONS: string[] = [
  `CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
   CREATE TABLE templates (id TEXT PRIMARY KEY, json TEXT NOT NULL, built_in INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE events (
     id TEXT PRIMARY KEY, name TEXT NOT NULL, date TEXT NOT NULL, template_id TEXT NOT NULL,
     photos_per_session INTEGER NOT NULL, countdown_seconds INTEGER NOT NULL, retakes_allowed INTEGER NOT NULL,
     print_copies INTEGER NOT NULL, auto_print INTEGER NOT NULL, gallery_enabled INTEGER NOT NULL, created_at TEXT NOT NULL);
   CREATE TABLE sessions (
     id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE, status TEXT NOT NULL,
     photo_paths TEXT NOT NULL, composite_path TEXT, print_path TEXT, gallery_url TEXT, created_at TEXT NOT NULL);
   CREATE INDEX sessions_event ON sessions(event_id, created_at);
   CREATE TABLE print_jobs (
     id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
     request_key TEXT NOT NULL, file_path TEXT NOT NULL, format TEXT NOT NULL, copies INTEGER NOT NULL,
     status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT,
     created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(session_id, request_key));
   CREATE TABLE uploads (
     id TEXT PRIMARY KEY, session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
     file_path TEXT NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
     next_attempt_at TEXT NOT NULL, url TEXT, last_error TEXT);`,
  `ALTER TABLE events ADD COLUMN exposure TEXT;`,
  `ALTER TABLE events ADD COLUMN shot_interval_seconds INTEGER NOT NULL DEFAULT 3;
   ALTER TABLE events ADD COLUMN photo_review_seconds INTEGER NOT NULL DEFAULT 3;
   ALTER TABLE events ADD COLUMN done_screen_seconds INTEGER NOT NULL DEFAULT 20;
   ALTER TABLE events ADD COLUMN show_gallery INTEGER NOT NULL DEFAULT 1;
   UPDATE events SET shot_interval_seconds = countdown_seconds;
   ALTER TABLE sessions ADD COLUMN gif_path TEXT;`,
  `ALTER TABLE events ADD COLUMN look TEXT NOT NULL DEFAULT 'colour';
   ALTER TABLE events ADD COLUMN skin_smoothing INTEGER NOT NULL DEFAULT 50;
   ALTER TABLE events ADD COLUMN colour_copy INTEGER NOT NULL DEFAULT 0;`
]

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(v)))

export const DEFAULT_DEVICE_SETTINGS: DeviceSettings = {
  kioskLock: true,
  cameraDriver: 'auto',
  printerDriver: 'auto',
  // Empty = detect the DNP printer, whatever Windows named it.
  printerName4x6: '',
  printerName2x6: ''
}

const now = () => new Date().toISOString()
const LOOK_IDS = new Set<string>(LOOKS.map((l) => l.id))

export class BoothDatabase {
  readonly db: Database.Database

  constructor(file: string) {
    this.db = new Database(file)
    this.db.pragma('journal_mode = WAL') // survives power loss mid-event far better than the default
    this.db.pragma('foreign_keys = ON')
    this.migrate()
    this.seedTemplates()
  }

  private migrate(): void {
    const version = this.db.pragma('user_version', { simple: true }) as number
    for (let v = version; v < MIGRATIONS.length; v++) {
      this.db.transaction(() => {
        this.db.exec(MIGRATIONS[v])
        this.db.pragma(`user_version = ${v + 1}`)
      })()
    }
  }

  private seedTemplates(): void {
    const upsert = this.db.prepare('INSERT INTO templates (id, json, built_in) VALUES (?, ?, 1) ON CONFLICT(id) DO UPDATE SET json = excluded.json WHERE built_in = 1')
    for (const t of BUILT_IN_TEMPLATES) upsert.run(t.id, JSON.stringify(t))
  }

  close(): void {
    this.db.close()
  }

  // ---------- settings ----------
  getDeviceSettings(): DeviceSettings {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = 'devices'").get() as { value: string } | undefined
    return { ...DEFAULT_DEVICE_SETTINGS, ...(row ? JSON.parse(row.value) : {}) }
  }

  saveDeviceSettings(s: DeviceSettings): void {
    this.db.prepare("INSERT INTO settings (key, value) VALUES ('devices', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify(s))
  }

  // ---------- paper ----------
  /** null until the operator records a roll; then sheets sent (copies of 'sent' jobs) since loading it. */
  getPaper(): PaperState | null {
    const raw = this.getSetting('paper')
    if (!raw) return null
    const { capacity, loadedAt } = JSON.parse(raw) as { capacity: number; loadedAt: string }
    const used = (this.db.prepare("SELECT COALESCE(SUM(copies), 0) AS n FROM print_jobs WHERE status = 'sent' AND updated_at >= ?").get(loadedAt) as { n: number }).n
    return { capacity, used, remaining: Math.max(0, capacity - used), loadedAt }
  }

  newPaperRoll(capacity: number, at = now()): PaperState {
    this.setSetting('paper', JSON.stringify({ capacity: clamp(capacity, 1, 5000), loadedAt: at }))
    return this.getPaper()!
  }

  getSetting(key: string): string | undefined {
    return (this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined)?.value
  }

  /** null removes the setting. */
  setSetting(key: string, value: string | null): void {
    if (value === null) this.db.prepare('DELETE FROM settings WHERE key = ?').run(key)
    else this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
  }

  getActiveEventId(): string | undefined {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = 'active_event'").get() as { value: string } | undefined
    return row?.value
  }

  setActiveEventId(id: string): void {
    this.db.prepare("INSERT INTO settings (key, value) VALUES ('active_event', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(id)
  }

  // ---------- templates ----------
  listTemplates(): Template[] {
    return (this.db.prepare('SELECT json FROM templates ORDER BY built_in DESC, id').all() as { json: string }[]).map((r) => JSON.parse(r.json))
  }

  getTemplate(id: string): Template | undefined {
    const row = this.db.prepare('SELECT json FROM templates WHERE id = ?').get(id) as { json: string } | undefined
    return row ? JSON.parse(row.json) : undefined
  }

  saveTemplate(t: Template): Template {
    const builtIn = this.db.prepare('SELECT built_in FROM templates WHERE id = ?').get(t.id) as { built_in: number } | undefined
    // Never overwrite a built-in; save edits as a copy instead.
    const toSave = builtIn?.built_in ? { ...t, id: `${t.id}-copy-${randomUUID().slice(0, 6)}` } : t
    this.db.prepare('INSERT INTO templates (id, json, built_in) VALUES (?, ?, 0) ON CONFLICT(id) DO UPDATE SET json = excluded.json').run(toSave.id, JSON.stringify(toSave))
    return toSave
  }

  deleteTemplate(id: string): void {
    const row = this.db.prepare('SELECT built_in FROM templates WHERE id = ?').get(id) as { built_in: number } | undefined
    if (row?.built_in) throw new Error('Built-in templates cannot be deleted.')
    const users = this.db.prepare('SELECT name FROM events WHERE template_id = ?').all(id) as { name: string }[]
    if (users.length) throw new Error(`This template is used by: ${users.map((u) => u.name).join(', ')}. Pick another template for those events first.`)
    this.db.prepare('DELETE FROM templates WHERE id = ?').run(id)
  }

  // ---------- events ----------
  private mapEvent(r: any): BoothEvent {
    return {
      id: r.id, name: r.name, date: r.date, templateId: r.template_id,
      photosPerSession: r.photos_per_session, countdownSeconds: r.countdown_seconds, retakesAllowed: r.retakes_allowed,
      printCopies: r.print_copies, autoPrint: !!r.auto_print, galleryEnabled: !!r.gallery_enabled,
      shotIntervalSeconds: r.shot_interval_seconds, photoReviewSeconds: r.photo_review_seconds,
      doneScreenSeconds: r.done_screen_seconds, showGallery: !!r.show_gallery,
      look: LOOK_IDS.has(r.look) ? r.look : 'colour', skinSmoothing: r.skin_smoothing, colourCopy: !!r.colour_copy,
      exposure: r.exposure ? JSON.parse(r.exposure) : undefined, createdAt: r.created_at
    }
  }

  listEvents(): BoothEvent[] {
    return this.db.prepare('SELECT * FROM events ORDER BY date DESC, created_at DESC').all().map((r) => this.mapEvent(r))
  }

  getEvent(id: string): BoothEvent | undefined {
    const r = this.db.prepare('SELECT * FROM events WHERE id = ?').get(id)
    return r ? this.mapEvent(r) : undefined
  }

  saveEvent(e: EventInput): BoothEvent {
    const template = this.getTemplate(e.templateId)
    if (!template) throw new Error('Unknown template')
    const ev: BoothEvent = {
      ...e,
      id: e.id ?? randomUUID(),
      createdAt: (e.id && this.getEvent(e.id)?.createdAt) || now(),
      // MVP: one photo per template slot. (Extra "gallery-only" shots are a later enhancement.)
      photosPerSession: template.slots.length,
      countdownSeconds: clamp(e.countdownSeconds, 1, 10),
      shotIntervalSeconds: clamp(e.shotIntervalSeconds ?? e.countdownSeconds, 1, 10),
      photoReviewSeconds: clamp(e.photoReviewSeconds ?? 3, 0, 10),
      doneScreenSeconds: clamp(e.doneScreenSeconds ?? 20, 5, 120),
      showGallery: e.showGallery ?? true,
      look: e.look && LOOK_IDS.has(e.look) ? e.look : 'colour',
      skinSmoothing: clamp(e.skinSmoothing ?? 50, 0, 100),
      colourCopy: e.colourCopy ?? false,
      retakesAllowed: clamp(e.retakesAllowed, 0, 10),
      printCopies: clamp(e.printCopies, 0, 10)
    }
    this.db
      .prepare(
        `INSERT INTO events (id, name, date, template_id, photos_per_session, countdown_seconds, retakes_allowed, print_copies, auto_print, gallery_enabled,
           shot_interval_seconds, photo_review_seconds, done_screen_seconds, show_gallery, look, skin_smoothing, colour_copy, exposure, created_at)
         VALUES (@id, @name, @date, @templateId, @photosPerSession, @countdownSeconds, @retakesAllowed, @printCopies, @autoPrint, @galleryEnabled,
           @shotIntervalSeconds, @photoReviewSeconds, @doneScreenSeconds, @showGallery, @look, @skinSmoothing, @colourCopy, @exposure, @createdAt)
         ON CONFLICT(id) DO UPDATE SET name=@name, date=@date, template_id=@templateId, photos_per_session=@photosPerSession,
           countdown_seconds=@countdownSeconds, retakes_allowed=@retakesAllowed, print_copies=@printCopies, auto_print=@autoPrint, gallery_enabled=@galleryEnabled,
           shot_interval_seconds=@shotIntervalSeconds, photo_review_seconds=@photoReviewSeconds, done_screen_seconds=@doneScreenSeconds, show_gallery=@showGallery,
           look=@look, skin_smoothing=@skinSmoothing, colour_copy=@colourCopy`
      )
      .run({
        ...ev,
        autoPrint: ev.autoPrint ? 1 : 0,
        galleryEnabled: ev.galleryEnabled ? 1 : 0,
        showGallery: ev.showGallery ? 1 : 0,
        colourCopy: ev.colourCopy ? 1 : 0,
        exposure: ev.exposure ? JSON.stringify(ev.exposure) : null
      })
    // Exposure is only written on insert; afterwards saveEventExposure owns it.
    return this.getEvent(ev.id)!
  }

  /** Saved from the Camera screen; separate from saveEvent so it never races the event form. */
  saveEventExposure(id: string, exposure: ExposureSettings): void {
    this.db.prepare('UPDATE events SET exposure = ? WHERE id = ?').run(JSON.stringify(exposure), id)
  }

  duplicateEvent(id: string): BoothEvent {
    const ev = this.getEvent(id)
    if (!ev) throw new Error('Unknown event')
    const { id: _id, createdAt: _created, ...rest } = ev
    return this.saveEvent({ ...rest, name: `${ev.name} (copy)`, date: todayIso() })
  }

  eventStats(eventId: string): EventStats {
    const sessions = (this.db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE event_id = ? AND status = 'complete'").get(eventId) as { n: number }).n
    const jobs = this.db
      .prepare('SELECT j.status, COUNT(*) AS n, SUM(j.copies) AS copies FROM print_jobs j JOIN sessions s ON s.id = j.session_id WHERE s.event_id = ? GROUP BY j.status')
      .all(eventId) as { status: PrintJobStatus; n: number; copies: number }[]
    const job = (st: PrintJobStatus) => jobs.find((r) => r.status === st)
    const lastPrintError = this.db
      .prepare('SELECT j.last_error AS e FROM print_jobs j JOIN sessions s ON s.id = j.session_id WHERE s.event_id = ? AND j.last_error IS NOT NULL ORDER BY j.updated_at DESC LIMIT 1')
      .get(eventId) as { e: string } | undefined
    const ups = this.db
      .prepare('SELECT u.status, COUNT(*) AS n FROM uploads u JOIN sessions s ON s.id = u.session_id WHERE s.event_id = ? GROUP BY u.status')
      .all(eventId) as { status: UploadStatus; n: number }[]
    const up = (st: UploadStatus) => ups.find((r) => r.status === st)?.n ?? 0
    const lastUploadError = this.db
      .prepare('SELECT u.last_error AS e FROM uploads u JOIN sessions s ON s.id = u.session_id WHERE s.event_id = ? AND u.last_error IS NOT NULL ORDER BY u.next_attempt_at DESC LIMIT 1')
      .get(eventId) as { e: string } | undefined
    return {
      sessions,
      prints: {
        sent: job('sent')?.copies ?? 0,
        pending: (job('queued')?.n ?? 0) + (job('sending')?.n ?? 0),
        failed: (job('failed')?.n ?? 0) + (job('needs_check')?.n ?? 0),
        ...(lastPrintError ? { lastError: lastPrintError.e } : {})
      },
      uploads: { done: up('done'), pending: up('pending') + up('uploading'), failed: up('failed'), ...(lastUploadError ? { lastError: lastUploadError.e } : {}) }
    }
  }

  deleteEvent(id: string): void {
    this.db.prepare('DELETE FROM events WHERE id = ?').run(id)
  }

  // ---------- sessions ----------
  private mapSession(r: any): SessionRecord {
    return {
      id: r.id, eventId: r.event_id, status: r.status, photoPaths: JSON.parse(r.photo_paths),
      compositePath: r.composite_path ?? undefined, printPath: r.print_path ?? undefined, gifPath: r.gif_path ?? undefined,
      galleryUrl: r.gallery_url ?? undefined, createdAt: r.created_at
    }
  }

  createSession(eventId: string): SessionRecord {
    const s: SessionRecord = { id: randomUUID(), eventId, status: 'capturing', photoPaths: [], createdAt: now() }
    this.db.prepare('INSERT INTO sessions (id, event_id, status, photo_paths, created_at) VALUES (?, ?, ?, ?, ?)').run(s.id, eventId, s.status, '[]', s.createdAt)
    return s
  }

  getSession(id: string): SessionRecord | undefined {
    const r = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id)
    return r ? this.mapSession(r) : undefined
  }

  listSessions(eventId: string, limit = 200): SessionRecord[] {
    return this.db.prepare('SELECT * FROM sessions WHERE event_id = ? ORDER BY created_at DESC LIMIT ?').all(eventId, limit).map((r) => this.mapSession(r))
  }

  updateSession(id: string, patch: Partial<{ status: SessionStatus; photoPaths: string[]; compositePath: string; printPath: string; gifPath: string; galleryUrl: string }>): void {
    const cur = this.getSession(id)
    if (!cur) throw new Error('Session not found')
    const next = { ...cur, ...patch }
    this.db
      .prepare('UPDATE sessions SET status=?, photo_paths=?, composite_path=?, print_path=?, gif_path=?, gallery_url=? WHERE id=?')
      .run(next.status, JSON.stringify(next.photoPaths), next.compositePath ?? null, next.printPath ?? null, next.gifPath ?? null, next.galleryUrl ?? null, id)
  }

  // ---------- print jobs ----------
  private mapJob(r: any): PrintJob {
    return {
      id: r.id, sessionId: r.session_id, filePath: r.file_path, format: r.format, copies: r.copies, status: r.status,
      attempts: r.attempts, lastError: r.last_error ?? undefined, createdAt: r.created_at, updatedAt: r.updated_at
    }
  }

  /**
   * Idempotent: the same (sessionId, requestKey) returns the existing job instead of creating a duplicate.
   * The UI passes a key per button press, so a double-tap or an IPC retry can't print twice.
   */
  insertPrintJob(sessionId: string, requestKey: string, filePath: string, format: PrintFormat, copies: number): PrintJob {
    const existing = this.db.prepare('SELECT * FROM print_jobs WHERE session_id = ? AND request_key = ?').get(sessionId, requestKey)
    if (existing) return this.mapJob(existing)
    const t = now()
    const id = randomUUID()
    this.db
      .prepare("INSERT INTO print_jobs (id, session_id, request_key, file_path, format, copies, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'queued', ?, ?)")
      .run(id, sessionId, requestKey, filePath, format, copies, t, t)
    return this.getPrintJob(id)!
  }

  getPrintJob(id: string): PrintJob | undefined {
    const r = this.db.prepare('SELECT * FROM print_jobs WHERE id = ?').get(id)
    return r ? this.mapJob(r) : undefined
  }

  listPrintJobs(limit = 100): PrintJob[] {
    return this.db.prepare('SELECT * FROM print_jobs ORDER BY created_at DESC LIMIT ?').all(limit).map((r) => this.mapJob(r))
  }

  nextQueuedPrintJob(): PrintJob | undefined {
    const r = this.db.prepare("SELECT * FROM print_jobs WHERE status = 'queued' ORDER BY created_at LIMIT 1").get()
    return r ? this.mapJob(r) : undefined
  }

  /** Compare-and-set so two workers (or a crash/restart) can't both send the same job. */
  transitionPrintJob(id: string, from: PrintJobStatus[], to: PrintJobStatus, extra: { error?: string; incAttempts?: boolean } = {}): boolean {
    const placeholders = from.map(() => '?').join(',')
    const res = this.db
      .prepare(`UPDATE print_jobs SET status = ?, updated_at = ?, last_error = COALESCE(?, last_error), attempts = attempts + ? WHERE id = ? AND status IN (${placeholders})`)
      .run(to, now(), extra.error ?? null, extra.incAttempts ? 1 : 0, id, ...from)
    return res.changes === 1
  }

  /** On startup: a job left in 'sending' may or may not have printed — make the operator decide. */
  flagInterruptedPrintJobs(): number {
    return this.db.prepare("UPDATE print_jobs SET status = 'needs_check', last_error = 'App closed while sending — check the printer before reprinting', updated_at = ? WHERE status = 'sending'").run(now()).changes
  }

  // ---------- uploads ----------
  private mapUpload(r: any): UploadJob {
    return {
      id: r.id, sessionId: r.session_id, filePath: r.file_path, status: r.status, attempts: r.attempts,
      nextAttemptAt: r.next_attempt_at, url: r.url ?? undefined, lastError: r.last_error ?? undefined
    }
  }

  enqueueUpload(sessionId: string, filePath: string): UploadJob {
    this.db
      .prepare("INSERT INTO uploads (id, session_id, file_path, status, next_attempt_at) VALUES (?, ?, ?, 'pending', ?) ON CONFLICT(session_id) DO NOTHING")
      .run(randomUUID(), sessionId, filePath, now())
    return this.mapUpload(this.db.prepare('SELECT * FROM uploads WHERE session_id = ?').get(sessionId))
  }

  dueUploads(at: Date, limit = 5): UploadJob[] {
    return this.db
      .prepare("SELECT * FROM uploads WHERE status IN ('pending','failed') AND next_attempt_at <= ? ORDER BY next_attempt_at LIMIT ?")
      .all(at.toISOString(), limit)
      .map((r) => this.mapUpload(r))
  }

  updateUpload(id: string, patch: { status: UploadStatus; url?: string; error?: string; nextAttemptAt?: Date; incAttempts?: boolean }): void {
    this.db
      .prepare('UPDATE uploads SET status = ?, url = COALESCE(?, url), last_error = ?, next_attempt_at = COALESCE(?, next_attempt_at), attempts = attempts + ? WHERE id = ?')
      .run(patch.status, patch.url ?? null, patch.error ?? null, patch.nextAttemptAt?.toISOString() ?? null, patch.incAttempts ? 1 : 0, id)
  }

  resetStuckUploads(): void {
    this.db.prepare("UPDATE uploads SET status = 'pending' WHERE status = 'uploading'").run()
  }

  uploadStats(): { pending: number; failed: number; done: number } {
    const rows = this.db.prepare('SELECT status, COUNT(*) AS n FROM uploads GROUP BY status').all() as { status: string; n: number }[]
    const get = (s: string) => rows.find((r) => r.status === s)?.n ?? 0
    return { pending: get('pending') + get('uploading'), failed: get('failed'), done: get('done') }
  }
}
