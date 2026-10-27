import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { CloudGallery } from '../src/main/cloud/CloudGallery'
import { BoothDatabase } from '../src/main/db/database'
import type { PrinterAdapter, PrintRequest } from '../src/main/printer/PrinterAdapter'
import { PrintQueue } from '../src/main/queue/PrintQueue'
import { backoffMs, UploadQueue } from '../src/main/queue/UploadQueue'

function setup() {
  const db = new BoothDatabase(':memory:')
  const ev = db.saveEvent({ name: 'E', date: '2026-10-24', templateId: 'classic-strip-3', photosPerSession: 3, countdownSeconds: 3, retakesAllowed: 1, printCopies: 1, autoPrint: true, galleryEnabled: false })
  const s = db.createSession(ev.id)
  return { db, ev, s }
}

class FakePrinter implements PrinterAdapter {
  readonly driver = 'mock' as const
  printed: PrintRequest[] = []
  fail = 0
  async print(req: PrintRequest) {
    if (this.fail > 0) {
      this.fail--
      throw new Error('jam')
    }
    this.printed.push(req)
  }
  async getStatus() {
    return { driver: this.driver, state: 'ready' as const }
  }
  async detect() {
    return { installed: [], stripsUncut: false }
  }
}

describe('print queue', () => {
  it('same request key never creates a second job (double tap)', async () => {
    const { db, s } = setup()
    const p = new FakePrinter()
    const q = new PrintQueue(db, () => p)
    const a = q.enqueue(s.id, 'k1', '/x.jpg', '2x6', 2)
    const b = q.enqueue(s.id, 'k1', '/x.jpg', '2x6', 2)
    await q.drain()
    expect(b.id).toBe(a.id)
    expect(p.printed).toHaveLength(1)
    expect(p.printed[0].copies).toBe(2)
    expect(db.getPrintJob(a.id)!.status).toBe('sent')
  })

  it('failed jobs wait for the operator, then retry once', async () => {
    const { db, s } = setup()
    const p = new FakePrinter()
    p.fail = 1
    const q = new PrintQueue(db, () => p)
    const job = q.enqueue(s.id, 'k', '/x.jpg', '4x6', 1)
    await q.drain()
    expect(db.getPrintJob(job.id)).toMatchObject({ status: 'failed', lastError: 'jam', attempts: 1 })
    await q.drain()
    expect(p.printed).toHaveLength(0) // no automatic retry
    expect(q.retry(job.id)).toBe(true)
    await q.drain()
    expect(db.getPrintJob(job.id)).toMatchObject({ status: 'sent', attempts: 2 })
    expect(q.retry(job.id)).toBe(false) // can't re-send a sent job via retry
  })

  it('jobs interrupted mid-send are flagged for checking on restart, not resent', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pq-'))
    const file = join(dir, 'b.db')
    let { db } = { db: new BoothDatabase(file) }
    const ev = db.saveEvent({ name: 'E', date: '2026-10-24', templateId: 'portrait-single', photosPerSession: 1, countdownSeconds: 3, retakesAllowed: 0, printCopies: 1, autoPrint: true, galleryEnabled: false })
    const s = db.createSession(ev.id)
    const job = db.insertPrintJob(s.id, 'k', '/x.jpg', '4x6', 1)
    db.transitionPrintJob(job.id, ['queued'], 'sending')
    db.close() // simulate crash / power cut

    db = new BoothDatabase(file)
    const p = new FakePrinter()
    const q = new PrintQueue(db, () => p)
    await q.drain()
    expect(db.getPrintJob(job.id)!.status).toBe('needs_check')
    expect(p.printed).toHaveLength(0)
    expect(q.markPrinted(job.id)).toBe(true)
    expect(db.getPrintJob(job.id)!.status).toBe('sent')
    db.close()
  })

  it('processes jobs in order, one at a time', async () => {
    const { db, s } = setup()
    const p = new FakePrinter()
    const q = new PrintQueue(db, () => p)
    q.enqueue(s.id, 'a', '/a.jpg', '4x6', 1)
    q.enqueue(s.id, 'b', '/b.jpg', '4x6', 1)
    q.enqueue(s.id, 'c', '/c.jpg', '4x6', 1)
    await q.drain()
    await new Promise((r) => setTimeout(r, 10))
    expect(p.printed.map((r) => r.filePath)).toEqual(['/a.jpg', '/b.jpg', '/c.jpg'])
  })
})

describe('upload queue', () => {
  it('backs off exponentially and caps at 15 minutes', () => {
    expect(backoffMs(1)).toBe(15_000)
    expect(backoffMs(2)).toBe(30_000)
    expect(backoffMs(20)).toBe(15 * 60_000)
  })

  it('keeps sessions pending while offline and uploads when back', async () => {
    const { db, s } = setup()
    let online = false
    const gallery: CloudGallery = {
      enabled: true,
      upload: async (id) => {
        if (!online) throw new Error('offline')
        return `https://example.test/${id}`
      }
    }
    const q = new UploadQueue(db, gallery)
    q.enqueue(s.id, '/final.jpg')
    const t0 = new Date()
    await q.tick(t0)
    expect(db.uploadStats()).toEqual({ pending: 0, failed: 1, done: 0 })
    await q.tick(new Date(t0.getTime() + 1000)) // too soon: backoff not elapsed
    expect(db.uploadStats().failed).toBe(1)
    online = true
    await q.tick(new Date(t0.getTime() + 16_000))
    expect(db.uploadStats().done).toBe(1)
    expect(db.getSession(s.id)!.galleryUrl).toBe(`https://example.test/${s.id}`)
  })
})

describe('paper counter', () => {
  it('is unknown until a roll is recorded, then counts sheets actually sent since loading it', async () => {
    const { db, s } = setup()
    const printer = new FakePrinter()
    const q = new PrintQueue(db, () => printer)
    expect(db.getPaper()).toBeNull()

    q.enqueue(s.id, 'before-roll', '/tmp/a.jpg', '4x6', 2)
    await q.drain()
    const loaded = new Date(Date.now() + 5).toISOString()
    await new Promise((r) => setTimeout(r, 10))
    expect(db.newPaperRoll(700, loaded)).toMatchObject({ capacity: 700, used: 0, remaining: 700 })

    q.enqueue(s.id, 'k1', '/tmp/a.jpg', '2x6', 3)
    printer.fail = 1
    q.enqueue(s.id, 'k2', '/tmp/b.jpg', '4x6', 1) // fails: no paper used
    await q.drain()
    expect(db.getPaper()).toMatchObject({ used: 3, remaining: 697 })
  })
})
