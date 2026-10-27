import { existsSync, mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { BoothService } from '../src/main/BoothService'
import { boomerangPathFor, colourPathFor } from '../src/main/sessionFiles'
import { MockCamera } from '../src/main/camera/MockCamera'
import { DisabledGallery, type CloudGallery } from '../src/main/cloud/CloudGallery'
import { BoothDatabase } from '../src/main/db/database'
import { MockPrinter } from '../src/main/printer/MockPrinter'
import { PrintQueue } from '../src/main/queue/PrintQueue'
import { UploadQueue } from '../src/main/queue/UploadQueue'

async function setup(gallery: CloudGallery = new DisabledGallery(), templateId = 'classic-strip-3', qrWaitMs = 1500) {
  const dataDir = mkdtempSync(join(tmpdir(), 'booth-'))
  const db = new BoothDatabase(':memory:')
  const ev = db.saveEvent({ name: 'Priya & Tom', date: '2026-10-24', templateId, photosPerSession: 99, countdownSeconds: 3, retakesAllowed: 1, printCopies: 2, autoPrint: true, galleryEnabled: gallery.enabled })
  db.setActiveEventId(ev.id)
  const camera = new MockCamera()
  await camera.connect()
  const printer = new MockPrinter(join(dataDir, 'prints'), 10)
  const printQueue = new PrintQueue(db, () => printer)
  const uploadQueue = new UploadQueue(db, gallery)
  const service = new BoothService({ db, photosRoot: () => dataDir, camera: () => camera, printQueue, uploadQueue, gallery, qrWaitMs, backgroundPath: (id) => join(dataDir, `${id}.jpg`) })
  return { db, ev, service, printQueue, uploadQueue, dataDir, camera }
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

  it('glam events print black and white, and keep a colour copy for guests when asked', async () => {
    const { db, ev, service } = await setup()
    expect(ev).toMatchObject({ look: 'colour', colourCopy: false }) // events from before looks existed
    db.saveEvent({ ...ev, look: 'glam', skinSmoothing: 60, colourCopy: true })
    expect(db.getEvent(ev.id)).toMatchObject({ look: 'glam', skinSmoothing: 60, colourCopy: true })

    const { sessionId } = service.startSession()
    const shots = []
    for (let i = 0; i < 3; i++) shots.push((await service.capture(sessionId)).path)
    const res = await service.finish(sessionId, shots, 'k')

    // Colour balance of the first photo slot: equal channels = black and white.
    const slotStats = async (file: string) => {
      const crop = await sharp(file).extract({ left: 100, top: 100, width: 300, height: 200 }).toBuffer()
      const [r, g, b] = (await sharp(crop).stats()).channels
      return Math.max(Math.abs(r.mean - g.mean), Math.abs(r.mean - b.mean))
    }
    expect(await slotStats(res.session.compositePath!)).toBeLessThan(1.5)
        const colourFile = colourPathFor(res.session.compositePath!)
    expect(await slotStats(colourFile)).toBeGreaterThan(3)
    expect(res.colourPreview).toMatch(/^data:image\/jpeg/)
    expect((await service.galleryItem(sessionId)).colour).toMatch(/^data:image\/jpeg/)
  })

  it('records a boomerang from the live view that plays forward then back, and offers it with the session', async () => {
    const { db, ev, service } = await setup()
    db.saveEvent({ ...ev, boomerang: true })
    const { sessionId } = service.startSession()
    const shots = []
    for (let i = 0; i < 3; i++) shots.push((await service.capture(sessionId)).path)
    expect(await service.recordBoomerang(sessionId, 600)).toBe(true)
    const res = await service.finish(sessionId, shots, 'k')
    const clip = await sharp(boomerangPathFor(res.session.compositePath!), { animated: true }).metadata()
    expect(clip.pages).toBeGreaterThanOrEqual(6) // n frames forward + n-2 back
    expect(clip.loop).toBe(0)
    expect(clip.width).toBe(540)
    expect(res.boomerang).toMatch(/^data:image\/gif/)
    expect((await service.galleryItem(sessionId)).boomerang).toMatch(/^data:image\/gif/)
  })

  it("green screen: swaps the backdrop for the guest's chosen client background", async () => {
    const { db, ev, service, dataDir, camera } = await setup()
    camera.backdrop = 'green'
    const brand = { id: 'bg-aaaaaaaaaaaa', name: 'Acme wall' }
    const other = { id: 'bg-bbbbbbbbbbbb', name: 'Party' }
    await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#c0102e' } }).jpeg().toFile(join(dataDir, `${brand.id}.jpg`))
    await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#1040c0' } }).jpeg().toFile(join(dataDir, `${other.id}.jpg`))
    db.saveEvent({ ...ev, backdrop: 'green', backgrounds: [brand, other] })
    expect(db.getEvent(ev.id)?.backgrounds).toEqual([brand, other])

    const corner = async (backgroundId?: string) => {
      const { sessionId } = service.startSession()
      const shots = []
      for (let i = 0; i < 3; i++) shots.push((await service.capture(sessionId)).path)
      const res = await service.finish(sessionId, shots, `k-${backgroundId}`, { backgroundId })
      const crop = await sharp(res.session.compositePath!).extract({ left: 60, top: 60, width: 30, height: 30 }).toBuffer()
      return (await sharp(crop).stats()).channels.map((c) => Math.round(c.mean))
    }
    const [r, , b] = await corner() // default: the first (brand) background
    expect(r).toBeGreaterThan(150)
    expect(b).toBeLessThan(90)
    const [r2, , b2] = await corner(other.id)
    expect(b2).toBeGreaterThan(150)
    expect(r2).toBeLessThan(60)
  })

  it('saves everything in an operator-friendly event folder: Photos, Prints, GIFs, Boomerangs', async () => {
    const { db, ev, service, dataDir } = await setup()
    db.saveEvent({ ...ev, look: 'bw', colourCopy: true, boomerang: true })
    const { sessionId } = service.startSession()
    const shots = []
    for (let i = 0; i < 3; i++) shots.push((await service.capture(sessionId)).path)
    await service.recordBoomerang(sessionId, 600)
    await service.finish(sessionId, shots, 'k')

    const folder = join(dataDir, 'Priya & Tom 2026-10-24')
    expect(db.getEvent(ev.id)?.folder).toBe(folder)
    const stamp = db.getSession(sessionId)!.stamp!
    expect(stamp).toMatch(/^\d\d\.\d\d\.\d\d$/)
    expect(readdirSync(join(folder, 'Photos')).sort()).toEqual([`${stamp} 1.jpg`, `${stamp} 2.jpg`, `${stamp} 3.jpg`])
    expect(readdirSync(join(folder, 'Prints')).sort()).toEqual([`${stamp} colour.jpg`, `${stamp}.jpg`])
    expect(readdirSync(join(folder, 'GIFs'))).toEqual([`${stamp}.gif`])
    expect(readdirSync(join(folder, 'Boomerangs'))).toEqual([`${stamp}.gif`])
    expect(readdirSync(join(folder, '.booth')).sort()).toEqual([`${stamp} print-sheet.jpg`, `${stamp} thumb.jpg`])

    // Renaming the event later doesn't move or split its folder.
    db.saveEvent({ ...db.getEvent(ev.id)!, name: 'Priya & Tom Wedding' })
    const next = service.startSession()
    await service.capture(next.sessionId)
    expect(readdirSync(dataDir).filter((f) => f !== 'prints')).toEqual(['Priya & Tom 2026-10-24']) // 'prints' = this test's mock printer
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

  describe('instant QR (gallery knows the link before upload)', () => {
    const pageUrl = (id: string) => `https://gallery.test/s/${id}`

    it('shows the QR straight away while offline, and uploads later', async () => {
      let online = false
      const gallery: CloudGallery = {
        enabled: true,
        sessionUrl: pageUrl,
        upload: async (id) => {
          if (!online) throw new Error('offline')
          return pageUrl(id)
        }
      }
      // A long wait would time the test out if finish() still waited for the upload.
      const { db, service, uploadQueue } = await setup(gallery, 'portrait-single', 60_000)
      const { sessionId } = service.startSession()
      const shot = await service.capture(sessionId)
      const res = await service.finish(sessionId, [shot.path], 'k')

      expect(res.galleryUrl).toBe(pageUrl(sessionId))
      expect(res.qrDataUrl).toMatch(/^data:image\/png;base64,/)
      expect(res.printJobId).toBeDefined()
      // Not uploaded yet, so the session isn't marked as uploaded.
      expect(db.getSession(sessionId)!.galleryUrl).toBeUndefined()

      online = true
      await uploadQueue.tick(new Date(Date.now() + 60 * 60_000))
      expect(db.getSession(sessionId)!.galleryUrl).toBe(pageUrl(sessionId))
    }, 10_000)

    it('gives no QR when the event has the gallery turned off', async () => {
      const gallery: CloudGallery = { enabled: true, sessionUrl: pageUrl, upload: async (id) => pageUrl(id) }
      const { db, ev, service } = await setup(gallery, 'portrait-single')
      db.saveEvent({ ...ev, galleryEnabled: false })
      const { sessionId } = service.startSession()
      const shot = await service.capture(sessionId)
      const res = await service.finish(sessionId, [shot.path], 'k')
      expect(res.qrDataUrl).toBeUndefined()
      expect(res.galleryUrl).toBeUndefined()
      expect(db.uploadStats().pending + db.uploadStats().done).toBe(0)
    })
  })
})
