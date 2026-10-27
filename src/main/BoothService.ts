import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import QRCode from 'qrcode'
import sharp from 'sharp'
import type { BoothEvent, CaptureResult, FinishResult } from '../shared/types'
import type { CameraAdapter } from './camera/CameraAdapter'
import type { CloudGallery } from './cloud/CloudGallery'
import { compose, previewDataUrl } from './compose/composer'
import { boomerangPathFor, colourPathFor, gifPathFor, thumbPathFor } from './sessionFiles'
import type { BoothDatabase } from './db/database'
import type { PrintQueue } from './queue/PrintQueue'
import type { UploadQueue } from './queue/UploadQueue'

const GIF_FRAME = { w: 720, h: 480 }
const GIF_FRAME_MS = 700
const GALLERY_LIMIT = 60

/** Looping GIF of the session's photos, one frame each. */
async function makeGif(photoPaths: string[], out: string): Promise<void> {
  const frames = await Promise.all(photoPaths.map((p) => sharp(p).rotate().resize(GIF_FRAME.w, GIF_FRAME.h, { fit: 'cover' }).png().toBuffer()))
  // One delay per frame: a single number only applies to the first frame.
  await sharp(frames, { join: { animated: true } }).gif({ loop: 0, delay: frames.map(() => GIF_FRAME_MS) }).toFile(out)
}


const BOOMERANG_WIDTH = 540
const BOOMERANG_FRAME_MS = 70

/** Plays the frames forward then backward, looping: the classic boomerang. */
export async function makeBoomerang(frames: Buffer[], out: string): Promise<void> {
  const sized = await Promise.all(frames.map((f) => sharp(f).resize({ width: BOOMERANG_WIDTH }).png().toBuffer()))
  const sequence = [...sized, ...sized.slice(1, -1).reverse()]
  await sharp(sequence, { join: { animated: true } }).gif({ loop: 0, delay: sequence.map(() => BOOMERANG_FRAME_MS) }).toFile(out)
}

async function writeThumb(composite: Buffer | string, out: string): Promise<void> {
  await sharp(composite).resize({ height: 480, withoutEnlargement: true }).jpeg({ quality: 80 }).toFile(out)
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    p.then((v) => (clearTimeout(t), resolve(v)), (e) => (clearTimeout(t), reject(e)))
  })
}

/** Folder-safe version of an event name. */
export function safeName(s: string): string {
  return s.replace(/[^a-z0-9-_ ]/gi, '').trim().slice(0, 60) || 'event'
}

/**
 * Orchestrates a guest session: capture → compose → print → (optional) upload.
 * Contains no Electron imports so it can be tested in plain Node.
 */
export class BoothService {
  constructor(
    private deps: {
      db: BoothDatabase
      dataDir: string
      camera: () => CameraAdapter
      printQueue: PrintQueue
      uploadQueue: UploadQueue
      gallery: CloudGallery
      /** How long the done screen waits for an upload before giving up on showing a QR. */
      qrWaitMs?: number
      log?: (level: 'warn' | 'error', message: string) => void
      /** Trial watermark text, or undefined when the booth is licensed. */
      watermark?: () => string | undefined
      /** File of an imported background (green screen). */
      backgroundPath?: (id: string) => string
    }
  ) {}

  activeEvent(): BoothEvent {
    const { db } = this.deps
    const id = db.getActiveEventId()
    const ev = id ? db.getEvent(id) : undefined
    if (!ev) throw new Error('No active event. Open Admin and create or select an event.')
    return ev
  }

  private sessionDir(ev: BoothEvent, sessionId: string): string {
    return join(this.deps.dataDir, 'events', `${ev.date}-${safeName(ev.name)}-${ev.id.slice(0, 8)}`, sessionId)
  }

  startSession(): { sessionId: string; event: BoothEvent } {
    const ev = this.activeEvent()
    const s = this.deps.db.createSession(ev.id)
    return { sessionId: s.id, event: ev }
  }

  async capture(sessionId: string): Promise<CaptureResult> {
    const { db } = this.deps
    const session = db.getSession(sessionId)
    if (!session) throw new Error('Session not found')
    const ev = db.getEvent(session.eventId)!
    const path = await this.deps.camera().capture(join(this.sessionDir(ev, sessionId), 'originals'))
    db.updateSession(sessionId, { photoPaths: [...session.photoPaths, path] })
    return { path, preview: await previewDataUrl(path, 640) }
  }

  /**
   * Records ~1.5 s of live view for the session's boomerang. Returns false (and the session simply
   * carries on) when the camera has no live view or too few frames arrive.
   */
  async recordBoomerang(sessionId: string, durationMs = 1500): Promise<boolean> {
    const session = this.deps.db.getSession(sessionId)
    if (!session) throw new Error('Session not found')
    const ev = this.deps.db.getEvent(session.eventId)!
    const cam = this.deps.camera()
    if (!(await cam.startLiveView().catch(() => false))) return false
    const frames: Buffer[] = []
    const end = Date.now() + durationMs
    // A slow camera gets up to 1.5 s extra to deliver enough frames for a smooth loop.
    const hardEnd = end + 1500
    while (frames.length < 30 && (Date.now() < end || (frames.length < 6 && Date.now() < hardEnd))) {
      const f = await cam.getLiveViewFrame().catch(() => null)
      if (f && !(frames.length && f.equals(frames[frames.length - 1]))) frames.push(f)
      await new Promise((r) => setTimeout(r, 50))
    }
    if (frames.length < 4) return false
    const dir = this.sessionDir(ev, sessionId)
    await mkdir(dir, { recursive: true })
    await makeBoomerang(frames, boomerangPathFor(join(dir, 'final.jpg')))
    return true
  }

  /**
   * @param photoPaths the guest's final selection, in order (after any retakes)
   * @param requestKey unique per "finish" press; repeats return the existing print job
   */
  async finish(sessionId: string, photoPaths: string[], requestKey: string, opts: { backgroundId?: string } = {}): Promise<FinishResult> {
    const { db, printQueue, uploadQueue, gallery } = this.deps
    const session = db.getSession(sessionId)
    if (!session) throw new Error('Session not found')
    const known = new Set(session.photoPaths)
    if (!photoPaths.every((p) => known.has(p))) throw new Error('Photo does not belong to this session')

    const ev = db.getEvent(session.eventId)!
    const template = db.getTemplate(ev.templateId)
    if (!template) throw new Error('Event template is missing')

    const dir = this.sessionDir(ev, sessionId)
    await mkdir(dir, { recursive: true })
    const watermark = this.deps.watermark?.()
    const look = { look: ev.look, skinSmoothing: ev.skinSmoothing, background: this.backgroundFor(ev, opts.backgroundId) }
    const { composite, printSheet } = await compose({ template, photoPaths, eventName: ev.name, watermark, ...look })
    const compositePath = join(dir, 'final.jpg')
    // Glam/filter events can also give guests the colour version (shown on screen; saved next to the final).
    let colourPreview: string | undefined
    if (ev.colourCopy && ev.look !== 'colour') {
      const colour = await compose({ template, photoPaths, eventName: ev.name, watermark, background: look.background })
      await writeFile(colourPathFor(compositePath), colour.composite)
      colourPreview = await previewDataUrl(colour.composite, 700)
    }
    const printPath = join(dir, 'print-sheet.jpg')
    const gifPath = gifPathFor(compositePath)
    await writeFile(compositePath, composite)
    await writeFile(printPath, printSheet)
    // GIF and gallery thumbnail are extras: a failure here must never stop the print.
    const gifOk = await Promise.all([makeGif(photoPaths, gifPath), writeThumb(composite, thumbPathFor(compositePath))]).then(
      () => true,
      (e) => (this.deps.log?.('warn', `gif/thumbnail for session ${sessionId}: ${e instanceof Error ? e.message : e}`), false)
    )
    db.updateSession(sessionId, { status: 'composed', photoPaths, compositePath, printPath, ...(gifOk ? { gifPath } : {}) })

    let printJobId: string | undefined
    if (ev.autoPrint && ev.printCopies > 0) {
      printJobId = printQueue.enqueue(sessionId, `auto:${requestKey}`, printPath, template.format, ev.printCopies).id
    }

    let galleryUrl: string | undefined
    let qrDataUrl: string | undefined
    if (ev.galleryEnabled && gallery.enabled) {
      uploadQueue.enqueue(sessionId, compositePath)
      // Instant QR when the link is known up front; the upload finishes in the background.
      galleryUrl = gallery.sessionUrl?.(sessionId, ev.id) ?? (await this.waitForGalleryUrl(sessionId))
      if (galleryUrl) qrDataUrl = await QRCode.toDataURL(galleryUrl, { margin: 1, width: 512, errorCorrectionLevel: 'M' })
    }

    db.updateSession(sessionId, { status: 'complete' })
    const boomerangPath = boomerangPathFor(compositePath)
    const boomerang = existsSync(boomerangPath) ? `data:image/gif;base64,${(await readFile(boomerangPath)).toString('base64')}` : undefined
    return { session: db.getSession(sessionId)!, printPreview: await previewDataUrl(composite, 700), colourPreview, boomerang, galleryUrl, qrDataUrl, printJobId }
  }

  private async waitForGalleryUrl(sessionId: string): Promise<string | undefined> {
    const wait = this.deps.qrWaitMs ?? 8000
    const started = Date.now()
    while (Date.now() - started < wait) {
      const url = this.deps.db.getSession(sessionId)?.galleryUrl
      if (url) return url
      await withTimeout(this.deps.uploadQueue.tick(), 2000).catch(() => undefined)
      await new Promise((r) => setTimeout(r, 250))
    }
    return this.deps.db.getSession(sessionId)?.galleryUrl
  }

  /** Operator/guest reprint from history. */
  reprint(sessionId: string, requestKey: string, copies: number): string {
    const { db, printQueue } = this.deps
    const s = db.getSession(sessionId)
    if (!s?.printPath) throw new Error('This session has no print file yet')
    const ev = db.getEvent(s.eventId)!
    const template = db.getTemplate(ev.templateId)!
    return printQueue.enqueue(sessionId, `reprint:${requestKey}`, s.printPath, template.format, Math.max(1, Math.min(10, copies))).id
  }

  /** Finished sessions of the active event for the guest gallery, newest first. Empty when the event hides it. */
  async galleryList(): Promise<{ id: string; createdAt: string; thumb: string; hasGif: boolean }[]> {
    const ev = this.activeEventOrNull()
    if (!ev?.showGallery) return []
    const sessions = this.deps.db.listSessions(ev.id, GALLERY_LIMIT * 2).filter((s) => s.status === 'complete' && s.compositePath && existsSync(s.compositePath))
    const out = []
    for (const s of sessions.slice(0, GALLERY_LIMIT)) {
      const thumb = thumbPathFor(s.compositePath!)
      if (!existsSync(thumb)) await writeThumb(s.compositePath!, thumb) // sessions from before thumbnails existed
      out.push({ id: s.id, createdAt: s.createdAt, thumb: `data:image/jpeg;base64,${(await readFile(thumb)).toString('base64')}`, hasGif: !!s.gifPath && existsSync(s.gifPath) })
    }
    return out
  }

  /** One gallery entry at viewing size. Only finished sessions of the active event are ever returned to guests. */
  async galleryItem(sessionId: string): Promise<{ image: string; gif?: string; colour?: string; boomerang?: string }> {
    const ev = this.activeEventOrNull()
    const s = this.deps.db.getSession(sessionId)
    if (!ev?.showGallery || !s || s.eventId !== ev.id || s.status !== 'complete' || !s.compositePath || !existsSync(s.compositePath)) {
      throw new Error('This photo is not available.')
    }
    const gif = s.gifPath && existsSync(s.gifPath) ? `data:image/gif;base64,${(await readFile(s.gifPath)).toString('base64')}` : undefined
    const colourPath = colourPathFor(s.compositePath)
    const colour = existsSync(colourPath) ? await previewDataUrl(colourPath, 1000) : undefined
    const boomerangPath = boomerangPathFor(s.compositePath)
    const boomerang = existsSync(boomerangPath) ? `data:image/gif;base64,${(await readFile(boomerangPath)).toString('base64')}` : undefined
    return { image: await previewDataUrl(s.compositePath, 1000), gif, colour, boomerang }
  }

  /** The guest's chosen background, or the event's first; none unless the event uses a green/blue screen. */
  private backgroundFor(ev: BoothEvent, chosenId?: string): { path: string; key: 'green' | 'blue' } | undefined {
    if (ev.backdrop === 'none' || !ev.backgrounds.length || !this.deps.backgroundPath) return undefined
    const bg = ev.backgrounds.find((b) => b.id === chosenId) ?? ev.backgrounds[0]
    const path = this.deps.backgroundPath(bg.id)
    return existsSync(path) ? { path, key: ev.backdrop } : undefined
  }

  private activeEventOrNull(): BoothEvent | undefined {
    const id = this.deps.db.getActiveEventId()
    return id ? this.deps.db.getEvent(id) : undefined
  }
}