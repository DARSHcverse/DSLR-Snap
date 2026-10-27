import { app, BrowserWindow, dialog, ipcMain, powerSaveBlocker, safeStorage, shell } from 'electron'
import { randomBytes, randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { appendFile, mkdir, readdir, rm, statfs, writeFile } from 'node:fs/promises'
import { hostname, networkInterfaces } from 'node:os'
import { basename, extname, join, resolve } from 'node:path'
import QRCode from 'qrcode'
import sharp from 'sharp'
import type { DeviceSnapshot } from '../shared/api'
import { flashSafe } from '../shared/exposure'
import { canvasSize, SHEET, validateTemplate } from '../shared/layout'
import type { DeviceSettings, ExposureKey, ExposureSettings, Look, PrintFormat, Template, TemplateImportDraft, TemplateImportOptions, TestShot } from '../shared/types'
import { BoothService } from './BoothService'
import { exportEventPhotos } from './exportEvent'
import { isBlockedWhileLocked, shouldLock } from './kiosk'
import { resolveCameraDriver, resolvePrinterDriver } from './detectDevices'
import { PinLock } from './security/PinLock'
import { type RemoteAction, RemoteServer, type RemoteStatus } from './remote/RemoteServer'
import { thumbPathFor } from './sessionFiles'
import { analyzeShot } from './camera/analyzeShot'
import { applyExposure, readExposure, withFlashSafeShutters } from './camera/applyExposure'
import type { CameraAdapter } from './camera/CameraAdapter'
import { CanonBridgeCamera } from './camera/CanonBridgeCamera'
import { MockCamera } from './camera/MockCamera'
import { type CloudGallery, galleryFromEnv } from './cloud/CloudGallery'
import { HostedGallery } from './cloud/HostedGallery'
import { compose, previewDataUrl } from './compose/composer'
import { createSampleShots } from './compose/sampleShots'
import { defaultSlots, detectSlots, guessLayout, type Layout, normalizeArtwork, suggestFit } from './compose/templateImport'
import { BoothDatabase } from './db/database'
import { AccountService } from './licence/AccountService'
import { machineHash } from './licence/machineId'
import { MockPrinter } from './printer/MockPrinter'
import type { PrinterAdapter } from './printer/PrinterAdapter'
import { WindowsPrinter } from './printer/WindowsPrinter'
import { PrintQueue } from './queue/PrintQueue'
import { UploadQueue } from './queue/UploadQueue'

if (!app.requestSingleInstanceLock()) app.quit()

// dslrsnap:// links bring the browser sign-in back to the app. In development Electron runs our
// script, so Windows has to be told to pass it along.
const PROTOCOL = 'dslrsnap'
if (process.defaultApp && process.argv[1]) app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [resolve(process.argv[1])])
else app.setAsDefaultProtocolClient(PROTOCOL)
const ACCOUNT_URL = (import.meta.env.MAIN_VITE_ACCOUNT_URL || 'https://dslrsnap.com').replace(/\/$/, '')
const deepLinkIn = (argv: string[]) => argv.find((a) => a.startsWith(`${PROTOCOL}://`))
let pendingDeepLink = deepLinkIn(process.argv) // Windows cold start: the link arrives as an argument

// Don't let libvips keep input files open between operations: if a file is rewritten at the same path
// (test print, re-imported artwork), a cached reader would hit the shorter file and crash with SIGBUS.
sharp.cache({ files: 0 })

const userData = app.getPath('userData')
const dataDir = join(app.getPath('documents'), 'DSLR Snap')
const logFile = join(userData, 'logs', 'booth.log')

async function log(level: 'info' | 'warn' | 'error', msg: string): Promise<void> {
  const line = `${new Date().toISOString()} [${level}] ${msg}\n`
  if (level === 'error') console.error(line.trim())
  await mkdir(join(userData, 'logs'), { recursive: true }).catch(() => undefined)
  await appendFile(logFile, line).catch(() => undefined)
}
process.on('uncaughtException', (e) => void log('error', `uncaught: ${e.stack ?? e}`))
process.on('unhandledRejection', (e) => void log('error', `unhandled rejection: ${e instanceof Error ? e.stack : e}`))

/** Minimal .env reader: operator config lives next to the database, never inside the installer. */
function loadEnv(file: string): void {
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

let win: BrowserWindow | null = null
let db: BoothDatabase
let camera: CameraAdapter
let printer: PrinterAdapter
let printQueue: PrintQueue
let uploadQueue: UploadQueue
let service: BoothService
let pinLock: PinLock
let account: AccountService
let gallery: CloudGallery
loadEnv(join(userData, '.env'))
loadEnv(join(process.cwd(), '.env')) // dev convenience

function bridgePath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'canon-bridge', 'CanonBridge.exe')
    : join(app.getAppPath(), 'native', 'CanonBridge', 'publish', 'CanonBridge.exe')
}

function makeCamera(s: DeviceSettings): CameraAdapter {
  const driver = resolveCameraDriver(s.cameraDriver, { platform: process.platform, bridgeInstalled: existsSync(bridgePath()) })
  const cam: CameraAdapter = driver === 'canon-edsdk' ? new CanonBridgeCamera(bridgePath()) : new MockCamera()
  cam.on('status', () => void broadcastDevices())
  cam.on('log', (m: string) => void log('info', `camera: ${m.trim()}`))
  cam.on('exposure', () => win?.webContents.send('booth:exposure'))
  return cam
}

function makePrinter(s: DeviceSettings): PrinterAdapter {
  return resolvePrinterDriver(s.printerDriver, process.platform) === 'windows-driver' ? new WindowsPrinter(() => db.getDeviceSettings()) : new MockPrinter(join(dataDir, 'mock-prints'))
}

async function connectCamera(): Promise<void> {
  try {
    await camera.connect()
    await log('info', `camera connected: ${camera.getStatus().model}`)
  } catch (e) {
    await log('warn', `camera connect failed: ${e instanceof Error ? e.message : e}`)
    return
  }
  await applyEventExposure()
}

/** Puts the active event's saved exposure back on the camera (after a reconnect or switching events). */
async function applyEventExposure(): Promise<void> {
  const id = db.getActiveEventId()
  const wanted = id ? db.getEvent(id)?.exposure : undefined
  if (!wanted || camera.getStatus().state !== 'ready') return
  try {
    const { skipped } = await applyExposure(camera, wanted)
    if (skipped.length) await log('warn', `camera exposure not applied for ${skipped.join(', ')} (mode dial not on M?)`)
    win?.webContents.send('booth:exposure')
  } catch (e) {
    await log('warn', `camera exposure: ${e instanceof Error ? e.message : e}`)
  }
}

/** Remembers the camera's exposure on an event (default: the active one), so it is re-applied next time. */
function rememberExposure(current: ExposureSettings, eventId = db.getActiveEventId()): void {
  if (eventId && db.getEvent(eventId)) db.saveEventExposure(eventId, current)
}

const TEST_SHOTS_KEPT = 12

async function testShot(): Promise<TestShot> {
  const settings = (await camera.getExposure().catch(() => null))?.current ?? {}
  const dir = join(userData, 'testshots')
  const path = await camera.capture(dir)
  // Test shots are throwaway; keep the folder small.
  const old = (await readdir(dir)).sort().reverse().slice(TEST_SHOTS_KEPT)
  await Promise.all(old.map((f) => rm(join(dir, f), { force: true })))
  return { path, preview: await previewDataUrl(path, 1600), settings, ...(await analyzeShot(path)), takenAt: new Date().toISOString() }
}

async function devices(): Promise<DeviceSnapshot> {
  const p = await printer.getStatus().catch((e) => ({ driver: printer.driver, state: 'error' as const, message: String(e) }))
  return {
    camera: camera.getStatus(),
    printer: { ...p, queueLength: printQueue.pendingCount() },
    uploads: { enabled: gallery?.enabled ?? false, ...db.uploadStats() },
    paper: db.getPaper()
  }
}

let shuttingDown = false
let devicesTimer: NodeJS.Timeout | undefined

async function broadcastDevices(): Promise<void> {
  // The camera emits a last status change while disconnecting on quit; the database is closed by then.
  if (shuttingDown || !win || win.isDestroyed()) return
  try {
    const snapshot = await devices()
    if (!shuttingDown && !win.isDestroyed()) win.webContents.send('booth:devices', snapshot)
  } catch (e) {
    // devices() awaits the printer before reading the database; quitting may close it in between.
    if (!shuttingDown) throw e
  }
}

function handle(name: string, fn: (...args: any[]) => unknown): void {
  ipcMain.handle(`booth:${name}`, async (_e, ...args) => {
    try {
      return await fn(...args)
    } catch (e) {
      await log('error', `${name}: ${e instanceof Error ? e.stack : e}`)
      throw e
    }
  })
}

const sampleShots = createSampleShots(join(userData, 'template-previews'))

const IMPORTED_ID = /^imported-[0-9a-f]{8}$/

/** Imported artwork always lives at a path derived from the template id, so the renderer never supplies file paths. */
function artworkPath(id: string): string {
  if (!IMPORTED_ID.test(id)) throw new Error('Not an imported template.')
  return join(userData, 'templates', `${id}.png`)
}

/** Rebuilds an imported template from renderer data, keeping only the fields the editor may change. */
function cleanImported(t: Template): Template {
  if (!['2x6', '4x6'].includes(t.format) || !['portrait', 'landscape'].includes(t.orientation)) throw new Error('Unknown print layout.')
  const path = artworkPath(t.id)
  return {
    id: t.id,
    name: String(t.name ?? '').trim().slice(0, 80),
    format: t.format,
    orientation: t.format === '2x6' ? 'portrait' : t.orientation,
    background: '#ffffff',
    ...(t.overlayPath ? { overlayPath: path } : { backgroundPath: path }),
    slots: (t.slots ?? []).map((s) => ({ x: Math.round(s.x), y: Math.round(s.y), w: Math.round(s.w), h: Math.round(s.h) })),
    texts: []
  }
}

async function artworkPreview(input: string | Buffer): Promise<string> {
  const png = await sharp(input).resize({ width: 480, withoutEnlargement: true }).png().toBuffer()
  return `data:image/png;base64,${png.toString('base64')}`
}

const LAYOUT_LABEL = { '2x6': '2×6 strip', '4x6': '4×6' } as const

async function prepareTemplateImport(src: string, opts: TemplateImportOptions = {}): Promise<TemplateImportDraft> {
  if (!/\.(png|jpe?g|webp)$/i.test(src)) throw new Error('Use a PNG or JPG file.')
  const meta = await sharp(src).metadata().catch(() => {
    throw new Error("Couldn't read that file. Export your design as a PNG or JPG and try again.")
  })
  if (!meta.width || !meta.height) throw new Error("Couldn't read the size of that image.")
  // EXIF orientations 5–8 are rotated 90°, so the visible width and height are swapped.
  const [w, h] = (meta.orientation ?? 1) >= 5 ? [meta.height, meta.width] : [meta.width, meta.height]
  const layout: Layout = opts.format
    ? { format: opts.format, orientation: opts.format === '2x6' ? 'portrait' : (opts.orientation ?? 'portrait') }
    : guessLayout(w, h)
  const fit = opts.fit ?? suggestFit(w, h, layout)
  const id = opts.draftId && IMPORTED_ID.test(opts.draftId) ? opts.draftId : `imported-${randomUUID().slice(0, 8)}`

  const png = await normalizeArtwork(src, layout, fit)
  const found = await detectSlots(png)
  await mkdir(join(userData, 'templates'), { recursive: true })
  await writeFile(artworkPath(id), png)

  const size = canvasSize(layout.format, layout.orientation)
  const notes: string[] = []
  if (suggestFit(w, h, layout) === 'fit') notes.push(`This design is a different shape from a ${LAYOUT_LABEL[layout.format]} print. Check the fit below.`)
  if (Math.max(w, h) < Math.max(size.w, size.h) * 0.7) notes.push(`The image is small (${w}×${h}) and may print soft. Export at ${size.w}×${size.h} or larger if you can.`)

  return {
    template: {
      id,
      name: basename(src, extname(src)).slice(0, 80),
      format: layout.format,
      orientation: layout.orientation,
      background: '#ffffff',
      ...(found.layer === 'over' ? { overlayPath: artworkPath(id) } : { backgroundPath: artworkPath(id) }),
      slots: found.slots.length ? found.slots : defaultSlots(layout),
      texts: []
    },
    artwork: await artworkPreview(png),
    source: { fileName: basename(src), width: w, height: h },
    fit,
    detection: found.method,
    notes
  }
}

function registerIpc(): void {
  handle('getActiveEvent', () => {
    const id = db.getActiveEventId()
    const event = id ? db.getEvent(id) : undefined
    const template = event ? db.getTemplate(event.templateId) : undefined
    return event && template ? { event, template } : null
  })
  handle('startSession', () => service.startSession())
  handle('capture', (sessionId: string) => service.capture(sessionId))
  handle('finish', (sessionId: string, paths: string[], key: string) => service.finish(sessionId, paths, key))
  handle('reprint', (sessionId: string, key: string, copies: number) => service.reprint(sessionId, key, copies))
  handle('galleryList', () => service.galleryList())
  handle('galleryItem', (sessionId: string) => service.galleryItem(sessionId))
  handle('liveViewStart', () => camera.startLiveView())
  handle('liveViewFrame', async () => {
    const f = await camera.getLiveViewFrame()
    return f ? `data:image/jpeg;base64,${f.toString('base64')}` : null
  })
  handle('liveViewStop', () => camera.stopLiveView())

  handle('listEvents', () => db.listEvents())
  handle('duplicateEvent', (id: string) => db.duplicateEvent(id))
  handle('eventStats', (id: string) => db.eventStats(id))
  handle('exportEventPhotos', async (eventId: string, originals: boolean) => {
    const res = await dialog.showOpenDialog(win!, { title: 'Export photos to…', properties: ['openDirectory', 'createDirectory'], buttonLabel: 'Export here' })
    if (res.canceled || !res.filePaths[0]) return null
    const out = await exportEventPhotos(db, eventId, res.filePaths[0], { originals })
    void shell.openPath(out.folder)
    return out
  })
  handle('hasPin', () => pinLock.hasPin())
  handle('verifyPin', (pin: string) => pinLock.verify(String(pin)))
  handle('setPin', (current: string | null, next: string | null) => pinLock.setPin(current, next))
  handle('saveEvent', (e) => db.saveEvent(e))
  handle('deleteEvent', (id: string) => db.deleteEvent(id))
  handle('setActiveEvent', (id: string) => {
    if (!db.getEvent(id)) throw new Error('Unknown event')
    db.setActiveEventId(id)
    void applyEventExposure()
  })
  handle('listTemplates', () => db.listTemplates())
  handle('previewTemplate', async (templateId: string, eventName: string, look?: { look: Look; skinSmoothing: number }) => {
    const t = db.getTemplate(templateId)
    if (!t) throw new Error('Unknown template')
    const { composite } = await compose({ template: t, photoPaths: await sampleShots(t.slots.length), eventName: eventName || 'Your Event', ...look })
    return previewDataUrl(composite, 520)
  })
  handle('chooseTemplateFile', async () => {
    const res = await dialog.showOpenDialog(win!, {
      title: 'Import a design',
      properties: ['openFile'],
      filters: [{ name: 'Designs (PNG, JPG)', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    })
    return res.canceled ? null : (res.filePaths[0] ?? null)
  })
  handle('prepareTemplateImport', (src: string, opts?: TemplateImportOptions) => prepareTemplateImport(src, opts))
  handle('getTemplateArtwork', async (id: string) => {
    const t = db.getTemplate(id)
    const path = t?.overlayPath ?? t?.backgroundPath
    return path && existsSync(path) ? artworkPreview(path) : null
  })
  handle('saveTemplate', (t: Template) => {
    const clean = cleanImported(t)
    if (!clean.name) throw new Error('Give the template a name.')
    if (!existsSync(artworkPath(clean.id))) throw new Error('The design file is missing. Import it again.')
    const errors = validateTemplate(clean).filter((i) => i.level === 'error')
    if (errors.length) throw new Error(errors.map((e) => e.message).join(' '))
    return db.saveTemplate(clean)
  })
  handle('deleteTemplate', async (id: string) => {
    db.deleteTemplate(id)
    if (IMPORTED_ID.test(id)) await rm(artworkPath(id), { force: true })
  })
  handle('discardTemplateDraft', async (id: string) => {
    // Only unsaved imports: a saved template keeps its artwork.
    if (IMPORTED_ID.test(id) && !db.getTemplate(id)) await rm(artworkPath(id), { force: true })
  })
  handle('previewTemplateDraft', async (t: Template, eventName: string) => {
    const clean = cleanImported(t)
    const { composite } = await compose({ template: clean, photoPaths: await sampleShots(clean.slots.length), eventName: eventName || 'Your Event' })
    return previewDataUrl(composite, 520)
  })
  handle('testPrintTemplate', async (t: Template) => {
    const template = IMPORTED_ID.test(t.id) ? cleanImported(t) : db.getTemplate(t.id)
    if (!template) throw new Error('Unknown template')
    const { printSheet } = await compose({ template, photoPaths: await sampleShots(template.slots.length), eventName: 'Test print' })
    const file = join(userData, 'test-template.jpg')
    await writeFile(file, printSheet)
    await printer.print({ filePath: file, format: template.format, copies: 1, jobName: 'test-template' })
    return file
  })
  handle('listSessions', (eventId: string) => db.listSessions(eventId))
  handle('openEventFolder', async () => {
    await mkdir(join(dataDir, 'events'), { recursive: true })
    await shell.openPath(join(dataDir, 'events'))
  })

  handle('getDeviceSettings', () => db.getDeviceSettings())
  handle('saveDeviceSettings', async (s: DeviceSettings) => {
    const prev = db.getDeviceSettings()
    db.saveDeviceSettings(s)
    if (prev.cameraDriver !== s.cameraDriver) {
      await camera.disconnect().catch(() => undefined)
      camera = makeCamera(s)
      void connectCamera()
    }
    if (prev.printerDriver !== s.printerDriver) printer = makePrinter(s)
    await broadcastDevices()
  })
  handle('detectPrinters', () => printer.detect())
  handle('reconnectCamera', async () => {
    await camera.disconnect().catch(() => undefined)
    await connectCamera()
  })
  handle('getDevices', () => devices())
  handle('getExposure', () => readExposure(camera))
  handle('setExposure', async (key: ExposureKey, value: string, eventId?: string) => {
    if (key === 'shutter' && !flashSafe([value]).length) throw new Error(`${value} is faster than the flash can sync.`)
    const state = withFlashSafeShutters(await camera.setExposure(key, value))
    rememberExposure(state.current, eventId)
    return state
  })
  handle('applyExposure', async (settings: ExposureSettings, eventId?: string) => {
    const res = await applyExposure(camera, settings)
    rememberExposure(res.state.current, eventId)
    return res
  })
  handle('testShot', () => testShot())

  handle('listPrintJobs', () => db.listPrintJobs())
  handle('retryPrintJob', (id: string) => printQueue.retry(id))
  handle('cancelPrintJob', (id: string) => printQueue.cancel(id))
  handle('markPrintJobPrinted', (id: string) => printQueue.markPrinted(id))

  handle('testPrint', async (format: PrintFormat) => {
    // Alignment chart: border at the sheet edge + safe-area box. Shows trimming and scaling at a glance.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET.w}" height="${SHEET.h}">
      <rect width="100%" height="100%" fill="#fff"/>
      <rect x="4" y="4" width="${SHEET.w - 8}" height="${SHEET.h - 8}" fill="none" stroke="#e00" stroke-width="8"/>
      <rect x="36" y="36" width="${SHEET.w - 72}" height="${SHEET.h - 72}" fill="none" stroke="#06c" stroke-width="4" stroke-dasharray="20 12"/>
      ${format === '2x6' ? `<line x1="${SHEET.w / 2}" y1="0" x2="${SHEET.w / 2}" y2="${SHEET.h}" stroke="#0a0" stroke-width="4"/>` : ''}
      <text x="50%" y="48%" text-anchor="middle" font-size="64" font-family="Arial" font-weight="bold">TEST ${format}</text>
      <text x="50%" y="53%" text-anchor="middle" font-size="34" font-family="Arial">${SHEET.w}×${SHEET.h}px @300dpi · ${new Date().toLocaleString('en-GB')}</text>
      <text x="50%" y="58%" text-anchor="middle" font-size="28" font-family="Arial" fill="#555">Red = sheet edge (may trim) · Blue = safe area · Green = 2" cut line</text>
    </svg>`
    const file = join(userData, `test-${format}.jpg`)
    await sharp(Buffer.from(svg)).jpeg({ quality: 95 }).withMetadata({ density: 300 }).toFile(file)
    await printer.print({ filePath: file, format, copies: 1, jobName: `test-${format}` })
    return file
  })
  handle('accountState', () => account.state())
  handle('accountSignIn', () => account.startSignIn())
  handle('accountRedeemCode', (code: string) => account.redeemCode(String(code)))
  handle('accountRefresh', () => account.refresh())
  handle('accountSignOut', () => account.signOut())
  handle('openAccountWebsite', (page: 'account' | 'pricing') => shell.openExternal(page === 'pricing' ? `${ACCOUNT_URL}/#pricing` : `${ACCOUNT_URL}/account`))
  handle('newPaperRoll', async (capacity: number) => {
    const paper = db.newPaperRoll(Number(capacity))
    await broadcastDevices()
    return paper
  })
  handle('eventGalleryLink', async (eventId: string) => {
    if (!(gallery instanceof HostedGallery)) throw new Error('The host gallery needs the DSLR Snap cloud (sign in under Account).')
    if (!gallery.enabled) throw new Error('Sign in with an active plan under Account to share the host gallery.')
    const url = await gallery.eventLink(eventId)
    return { url, qr: await QRCode.toDataURL(url, { margin: 1, width: 360 }) }
  })
  handle('diskFree', async () => {
    await mkdir(dataDir, { recursive: true })
    const s = await statfs(dataDir)
    return s.bavail * s.bsize
  })
  handle('appInfo', () => ({ version: app.getVersion(), dataDir, logFile }))
  handle('remoteInfo', () => remoteInfo())
  handle('remoteSetEnabled', async (on: boolean) => {
    db.setSetting('remote', JSON.stringify({ ...remoteSettings(), enabled: !!on }))
    await applyRemote()
    return remoteInfo()
  })
  handle('remoteNewLink', async () => {
    db.setSetting('remote', JSON.stringify({ ...remoteSettings(), key: randomBytes(16).toString('hex') }))
    await applyRemote()
    return remoteInfo()
  })
  handle('setPaused', (paused: boolean) => setPaused(!!paused))
  handle('setBoothShowing', (showing: boolean) => {
    applyBoothLock(!!showing)
    if (showing) win?.webContents.send('booth:paused', boothPaused) // a fresh booth screen picks up the pause
  })
  handle('quit', () => {
    allowQuit = true
    app.quit()
  })
}

// ---------- phone remote ----------
const REMOTE_PORT = 8765
let boothPaused = false
let remote: RemoteServer | undefined

function remoteSettings(): { enabled: boolean; key: string } {
  const saved = db.getSetting('remote')
  if (saved) return JSON.parse(saved)
  const fresh = { enabled: false, key: randomBytes(16).toString('hex') }
  db.setSetting('remote', JSON.stringify(fresh))
  return fresh
}

/** The computer's address on the venue network (first non-internal IPv4). */
function lanAddress(): string | undefined {
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) return a.address
  }
  return undefined
}

function setPaused(paused: boolean): void {
  boothPaused = paused
  win?.webContents.send('booth:paused', paused)
}

async function remoteStatus(): Promise<RemoteStatus> {
  const d = await devices()
  const eventId = db.getActiveEventId()
  const event = eventId ? db.getEvent(eventId) : undefined
  const stats = event ? db.eventStats(event.id) : undefined
  return {
    eventName: event?.name ?? null,
    paused: boothPaused,
    camera: { state: d.camera.state, detail: d.camera.state === 'ready' ? d.camera.model : d.camera.message },
    printer: { state: d.printer.state, detail: d.printer.message ?? d.printer.printerName, waiting: d.printer.queueLength },
    paper: d.paper ? { remaining: d.paper.remaining, capacity: d.paper.capacity } : null,
    guests: stats?.sessions ?? 0,
    prints: stats?.prints.sent ?? 0,
    failedJobs: db.listPrintJobs().filter((j) => j.status === 'failed' || j.status === 'needs_check').slice(0, 10).map((j) => ({ id: j.id, at: j.createdAt, error: j.lastError })),
    recent: event ? db.listSessions(event.id, 30).filter((x) => x.status === 'complete').slice(0, 6).map((x) => ({ id: x.id, at: x.createdAt })) : []
  }
}

async function remoteAct(a: RemoteAction): Promise<void> {
  if (a.action === 'pause' || a.action === 'resume') setPaused(a.action === 'pause')
  else if (a.action === 'retry') await printQueue.retry(a.jobId)
  else service.reprint(a.sessionId, randomUUID(), 1)
}

async function remoteThumb(sessionId: string): Promise<Buffer | null> {
  const s = db.getSession(sessionId)
  if (!s?.compositePath) return null
  const thumb = thumbPathFor(s.compositePath)
  return existsSync(thumb) ? readFileSync(thumb) : null
}

async function applyRemote(): Promise<void> {
  const cfg = remoteSettings()
  if (!cfg.enabled) {
    await remote?.stop()
    return
  }
  remote ??= new RemoteServer({ status: remoteStatus, act: remoteAct, thumb: remoteThumb }, cfg.key)
  remote.setKey(cfg.key)
  if (!remote.port) await remote.start(REMOTE_PORT).catch(() => remote!.start(0)) // port taken: any free one
}

async function remoteInfo(): Promise<{ enabled: boolean; url?: string; qr?: string; problem?: string }> {
  const cfg = remoteSettings()
  if (!cfg.enabled) return { enabled: false }
  const ip = lanAddress()
  if (!ip || !remote?.port) return { enabled: true, problem: 'This computer is not on a network. Connect it to the venue Wi-Fi or a phone hotspot.' }
  const url = `http://${ip}:${remote.port}/r/${cfg.key}`
  return { enabled: true, url, qr: await QRCode.toDataURL(url, { margin: 1, width: 360 }) }
}

// Kiosk lock: while guests are on the booth screen, the window covers the taskbar and ignores
// close/quit/reload shortcuts. Only the installed app locks, so development stays usable.
let boothLocked = false
let allowQuit = false
function applyBoothLock(boothShowing: boolean): void {
  const lock = shouldLock({ packaged: app.isPackaged, boothShowing, kioskLock: db.getDeviceSettings().kioskLock })
  if (lock === boothLocked) return
  boothLocked = lock
  win?.setKiosk(lock)
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: app.isPackaged, // kiosk-like on the Surface; windowed while developing
    autoHideMenuBar: true,
    backgroundColor: '#0b0b0f',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false, contextIsolation: true, nodeIntegration: false }
  })
  // Block navigation away from the app and pop-ups.
  win.webContents.on('will-navigate', (e) => e.preventDefault())
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('before-input-event', (e, input) => {
    if (boothLocked && isBlockedWhileLocked(input)) e.preventDefault()
  })
  win.on('close', (e) => {
    if (boothLocked && !allowQuit) e.preventDefault()
  })
  win.on('session-end', () => (allowQuit = true)) // Windows shutting down
  win.webContents.on('render-process-gone', (_e, d) => void log('error', `renderer gone: ${d.reason}`))

  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
}

async function openDeepLink(link: string): Promise<void> {
  if (!account) {
    pendingDeepLink = link
    return
  }
  try {
    await account.handleDeepLink(link)
  } catch (e) {
    await log('warn', `sign-in link: ${e instanceof Error ? e.message : e}`)
    win?.webContents.send('booth:accountError', e instanceof Error ? e.message : String(e))
  }
}

// macOS delivers links here (also on cold start, before ready).
app.on('open-url', (e, link) => {
  e.preventDefault()
  void openDeepLink(link)
})

app.on('second-instance', (_e, argv) => {
  const link = deepLinkIn(argv)
  if (link) void openDeepLink(link)
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.whenReady().then(async () => {
  await mkdir(join(userData, 'data'), { recursive: true })
  db = new BoothDatabase(join(userData, 'data', 'booth.db'))
  const settings = db.getDeviceSettings()
  camera = makeCamera(settings)
  printer = makePrinter(settings)
  printQueue = new PrintQueue(db, () => printer)
  printQueue.on('changed', () => {
    win?.webContents.send('booth:printJobs')
    void broadcastDevices()
  })
  printQueue.on('jobFailed', (id: string, e: unknown) => void log('error', `print job ${id} failed: ${e}`))
  pinLock = new PinLock(db)
  account = new AccountService({
    store: { get: (k) => db.getSetting(k), set: (k, v) => db.setSetting(k, v) },
    secrets: {
      encrypt: (s) => (safeStorage.isEncryptionAvailable() ? `v1:${safeStorage.encryptString(s).toString('base64')}` : `plain:${s}`),
      decrypt: (s) => (s.startsWith('v1:') ? safeStorage.decryptString(Buffer.from(s.slice(3), 'base64')) : s.replace(/^plain:/, ''))
    },
    accountUrl: ACCOUNT_URL,
    publicKey: import.meta.env.MAIN_VITE_LICENCE_PUBLIC_KEY ?? '',
    packaged: app.isPackaged,
    machineHash: await machineHash(),
    deviceName: hostname(),
    openExternal: (url) => shell.openExternal(url),
    log: (level, m) => void log(level, `account: ${m}`)
  })
  account.on('changed', () => win?.webContents.send('booth:account', account.state()))
  // Developer override: a Supabase service key in .env uploads straight to storage (own booths only).
  // Otherwise photos go through dslrsnap.com, which checks the booth's sign-in and plan.
  const devGallery = galleryFromEnv(process.env)
  gallery = devGallery.enabled
    ? devGallery
    : new HostedGallery({
        accountUrl: account.accountUrl,
        credentials: () => account.apiCredentials(),
        allowed: () => account.state().mode === 'licensed',
        event: (id) => db.getEvent(id)
      })
  uploadQueue = new UploadQueue(db, gallery)
  uploadQueue.on('changed', () => void broadcastDevices())
  service = new BoothService({
    db,
    dataDir,
    camera: () => camera,
    printQueue,
    uploadQueue,
    gallery,
    log: (level, m) => void log(level, m),
    watermark: () => account.watermark()
  })

  registerIpc()
  createWindow()

  // Event hardware must not sleep mid-party.
  powerSaveBlocker.start('prevent-display-sleep')
  void connectCamera()
  void printQueue.drain()
  uploadQueue.start()
  devicesTimer = setInterval(() => void broadcastDevices(), 5000)
  account.start()
  void applyRemote().catch((e) => log('warn', `phone remote: ${e}`))
  if (pendingDeepLink) void openDeepLink(pendingDeepLink)
  await log('info', `started v${app.getVersion()} · gallery ${gallery.enabled ? 'on' : 'off'}`)
})

app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => {
  allowQuit = true
  shuttingDown = true
  clearInterval(devicesTimer)
  printQueue?.stop()
  uploadQueue?.stop()
  account?.stop()
  void remote?.stop()
  void camera?.disconnect()
  db?.close()
})
