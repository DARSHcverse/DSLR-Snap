import { existsSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BoothDatabase } from '../src/main/db/database'
import { todayIso } from '../src/shared/dates'
import { exportEventPhotos } from '../src/main/exportEvent'

const base = { date: '2026-11-14', templateId: 'classic-strip-3', photosPerSession: 3, countdownSeconds: 3, retakesAllowed: 1, printCopies: 2, autoPrint: true, galleryEnabled: true }

describe('duplicateEvent', () => {
  it('copies settings and camera exposure under a new id, dated today', () => {
    const db = new BoothDatabase(':memory:')
    const ev = db.saveEvent({ ...base, name: 'Sarah & Tom', exposure: { iso: '400', aperture: '5.6' } })
    const copy = db.duplicateEvent(ev.id)
    expect(copy.id).not.toBe(ev.id)
    expect(copy).toMatchObject({ name: 'Sarah & Tom (copy)', templateId: 'classic-strip-3', printCopies: 2, exposure: { iso: '400', aperture: '5.6' } })
    expect(copy.date).toBe(todayIso())
    expect(db.listSessions(copy.id)).toEqual([])
  })
})

describe('event timing settings', () => {
  it('defaults sensibly for events saved without them (between-photo countdown = first countdown)', () => {
    const db = new BoothDatabase(':memory:')
    const ev = db.saveEvent({ ...base, name: 'Old style', countdownSeconds: 4 })
    expect(ev).toMatchObject({ shotIntervalSeconds: 4, photoReviewSeconds: 3, doneScreenSeconds: 20, showGallery: true })
  })

  it('stores, clamps and duplicates them', () => {
    const db = new BoothDatabase(':memory:')
    const ev = db.saveEvent({ ...base, name: 'Timed', countdownSeconds: 5, shotIntervalSeconds: 2, photoReviewSeconds: 0, doneScreenSeconds: 999, showGallery: false })
    expect(ev).toMatchObject({ countdownSeconds: 5, shotIntervalSeconds: 2, photoReviewSeconds: 0, doneScreenSeconds: 120, showGallery: false })
    expect(db.duplicateEvent(ev.id)).toMatchObject({ shotIntervalSeconds: 2, photoReviewSeconds: 0, doneScreenSeconds: 120, showGallery: false })
  })
})

describe('eventStats', () => {
  it('counts sessions, prints and uploads for one event only, with the latest error', () => {
    const db = new BoothDatabase(':memory:')
    const ev = db.saveEvent({ ...base, name: 'A' })
    const other = db.saveEvent({ ...base, name: 'B' })
    const s1 = db.createSession(ev.id)
    const s2 = db.createSession(ev.id)
    db.updateSession(s1.id, { status: 'complete' })
    db.updateSession(s2.id, { status: 'complete' })
    db.updateSession(db.createSession(other.id).id, { status: 'complete' })

    const sent = db.insertPrintJob(s1.id, 'k1', '/p1.jpg', '2x6', 2)
    db.transitionPrintJob(sent.id, ['queued'], 'sent')
    const failed = db.insertPrintJob(s2.id, 'k2', '/p2.jpg', '2x6', 1)
    db.transitionPrintJob(failed.id, ['queued'], 'failed', { error: 'Out of paper' })
    db.insertPrintJob(s2.id, 'k3', '/p3.jpg', '2x6', 1) // still queued

    const up = db.enqueueUpload(s1.id, '/c1.jpg')
    db.updateUpload(up.id, { status: 'failed', error: 'Offline' })

    expect(db.eventStats(ev.id)).toEqual({
      sessions: 2,
      prints: { sent: 2, pending: 1, failed: 1, lastError: 'Out of paper' },
      uploads: { done: 0, pending: 0, failed: 1, lastError: 'Offline' }
    })
    expect(db.eventStats(other.id).sessions).toBe(1)
  })
})

describe('exportEventPhotos', () => {
  it('copies finished designs (and optionally originals) into a folder named after the event, skipping missing files', async () => {
    const src = mkdtempSync(join(tmpdir(), 'src-'))
    const dest = mkdtempSync(join(tmpdir(), 'dest-'))
    const file = (name: string) => (writeFileSync(join(src, name), 'jpg'), join(src, name))
    const db = new BoothDatabase(':memory:')
    const ev = db.saveEvent({ ...base, name: 'Sarah & Tom: Wedding' })
    const s1 = db.createSession(ev.id)
    db.updateSession(s1.id, { status: 'complete', compositePath: file('c1.jpg'), photoPaths: [file('o1.jpg'), file('o2.jpg')] })
    const s2 = db.createSession(ev.id)
    db.updateSession(s2.id, { status: 'complete', compositePath: join(src, 'deleted.jpg'), photoPaths: [] })
    db.createSession(ev.id) // abandoned mid-session: not exported

    const res = await exportEventPhotos(db, ev.id, dest, { originals: true })
    expect(res).toMatchObject({ prints: 1, originals: 2, missing: 1 })
    expect(res.folder).toBe(join(dest, '2026-11-14 Sarah  Tom Wedding'))
    expect(readdirSync(join(res.folder, 'prints'))).toHaveLength(1)
    expect(readdirSync(join(res.folder, 'originals'))).toHaveLength(1) // one folder per session

    const noOriginals = await exportEventPhotos(db, ev.id, mkdtempSync(join(tmpdir(), 'dest-')), { originals: false })
    expect(noOriginals.originals).toBe(0)
    expect(existsSync(join(noOriginals.folder, 'originals'))).toBe(false)
  })
})
