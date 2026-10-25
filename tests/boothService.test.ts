import { existsSync, mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { BoothService } from '../src/main/BoothService'
import { MockCamera } from '../src/main/camera/MockCamera'
import { DisabledGallery, type CloudGallery } from '../src/main/cloud/CloudGallery'
import { BoothDatabase } from '../src/main/db/database'
import { MockPrinter } from '../src/main/printer/MockPrinter'
import { PrintQueue } from '../src/main/queue/PrintQueue'
import { UploadQueue } from '../src/main/queue/UploadQueue'

async function setup(gallery: CloudGallery = new DisabledGallery(), templateId = 'classic-strip-3') {
  const dataDir = mkdtempSync(join(tmpdir(), 'booth-'))
  const db = new BoothDatabase(':memory:')
  const ev = db.saveEvent({ name: 'Priya & Tom', date: '2026-10-24', templateId, photosPerSession: 99, countdownSeconds: 3, retakesAllowed: 1, printCopies: 2, autoPrint: true, galleryEnabled: gallery.enabled })
  db.setActiveEventId(ev.id)
  const camera = new MockCamera()
  await camera.connect()
  const printer = new MockPrinter(join(dataDir, 'prints'), 10)
  const printQueue = new PrintQueue(db, () => printer)
  const uploadQueue = new UploadQueue(db, gallery)
  const service = new BoothService({ db, dataDir, camera: () => camera, printQueue, uploadQueue, gallery, qrWaitMs: 1500 })
  return { db, ev, service, printQueue, dataDir }
}

describe('BoothService end to end (mock hardware)', () => {
  it('captures, composes, prints the right number of copies', async () => {
    const { db, ev, service, printQueue, dataDir } = await setup()
    expect(ev.photosPerSession).toBe(3) // clamped to template slots
    const { sessionId } = service.startSession()
    const shots = []
    for (let i = 0; i < 3; i++) shots.push((await service.capture(sessionId)).path)
    const res = await service.finish(sessionId, shots, 'press-1')
    expect(res.printJobId).toBeDefined()
    expect(res.qrDataUrl).toBeUndefined()
    expect(res.session.status).toBe('complete')
    expect(existsSync(res.session.compositePath!)).toBe(true)
    const sheet = await sharp(res.session.printPath!).metadata()
    expect([sheet.width, sheet.height]).toEqual([1248, 1844])

    // Pressing finish again with the same key must not print again
    await service.finish(sessionId, shots, 'press-1')
    await printQueue.drain()
    expect(db.listPrintJobs()).toHaveLength(1)
    expect(readdirSync(join(dataDir, 'prints'))).toHaveLength(2) // 2 copies
  })

  it('makes a looping GIF of the session photos and lists the session in the guest gallery', async () => {
    const { db, ev, service } = await setup()
    const { sessionId } = service.startSession()
    const shots = []
    for (let i = 0; i < 3; i++) shots.push((await service.capture(sessionId)).path)
    const res = await service.finish(sessionId, shots, 'k')
    const gif = await sharp(res.session.gifPath!, { animated: true }).metadata()
    expect(gif.format).toBe('gif')
    expect(gif.pages).toBe(3)
    expect(gif.loop).toBe(0) // loops forever
    expect(gif.delay?.every((d) => d > 0)).toBe(true) // every frame is shown, not just the first

    const unfinished = service.startSession() // not finished: must not appear
    const list = await service.galleryList()
    expect(list.map((g) => g.id)).toEqual([sessionId])
    expect(list[0]).toMatchObject({ hasGif: true })
    expect(list[0].thumb).toMatch(/^data:image\/jpeg;base64,/)

    const item = await service.galleryItem(sessionId)
    expect(item.image).toMatch(/^data:image\/jpeg;base64,/)
    expect(item.gif).toMatch(/^data:image\/gif;base64,/)
    await expect(service.galleryItem(unfinished.sessionId)).rejects.toThrow(/not available/)

    // Guests only ever see the active event's photos.
    const other = db.saveEvent({ ...ev, id: undefined, name: 'Other' })
    db.setActiveEventId(other.id)
    expect(await service.galleryList()).toEqual([])
    await expect(service.galleryItem(sessionId)).rejects.toThrow(/not available/)
  })

  it('keeps the gallery closed when the event turns it off', async () => {
    const { db, ev, service } = await setup()
    const { sessionId } = service.startSession()
    const shots = []
    for (let i = 0; i < 3; i++) shots.push((await service.capture(sessionId)).path)
    await service.finish(sessionId, shots, 'k')
    db.saveEvent({ ...ev, showGallery: false })
    expect(await service.galleryList()).toEqual([])
    await expect(service.galleryItem(sessionId)).rejects.toThrow(/not available/)
  })

  it('refuses photos that are not from this session', async () => {
    const { service } = await setup()
    const { sessionId } = service.startSession()
    await expect(service.finish(sessionId, ['/etc/passwd', '/a', '/b'], 'k')).rejects.toThrow(/does not belong/)
  })

  it('shows a QR code when the gallery upload succeeds', async () => {
    const gallery: CloudGallery = { enabled: true, upload: async (id) => `https://gallery.test/${id}` }
    const { service } = await setup(gallery, 'portrait-single')
    const { sessionId } = service.startSession()
    const shot = await service.capture(sessionId)
    const res = await service.finish(sessionId, [shot.path], 'k')
    expect(res.qrDataUrl).toMatch(/^data:image\/png;base64,/)
    expect(res.session.galleryUrl).toBe(`https://gallery.test/${sessionId}`)
  })

  it('still completes offline — print goes out, upload stays queued', async () => {
    const gallery: CloudGallery = { enabled: true, upload: async () => { throw new Error('offline') } }
    const { db, service } = await setup(gallery, 'portrait-single')
    const { sessionId } = service.startSession()
    const shot = await service.capture(sessionId)
    const res = await service.finish(sessionId, [shot.path], 'k')
    expect(res.qrDataUrl).toBeUndefined()
    expect(res.printJobId).toBeDefined()
    expect(db.uploadStats().failed).toBe(1)
  })
})
