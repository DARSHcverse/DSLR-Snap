import type {
  AccountState,
  BoothEvent,
  CameraStatus,
  CaptureResult,
  DeviceSettings,
  EventInput,
  EventStats,
  ExposureKey,
  ExposureSettings,
  ExposureState,
  FinishResult,
  Look,
  PaperState,
  PrintJob,
  PrinterDetection,
  PrinterStatus,
  SessionRecord,
  Template,
  TemplateImportDraft,
  TemplateImportOptions,
  TestShot
} from './types'

export interface RemoteInfo {
  enabled: boolean
  url?: string
  qr?: string
  problem?: string
}

export interface DeviceSnapshot {
  camera: CameraStatus
  printer: PrinterStatus
  uploads: { enabled: boolean; pending: number; failed: number; done: number }
  /** null until the operator records a roll. */
  paper: PaperState | null
}

/** Everything the renderer may ask the main process to do. Exposed as window.booth by the preload. */
export interface BoothApi {
  // booth flow
  getActiveEvent(): Promise<{ event: BoothEvent; template: Template } | null>
  startSession(): Promise<{ sessionId: string; event: BoothEvent }>
  capture(sessionId: string): Promise<CaptureResult>
  /** ~1.5 s from the live view, saved as the session's boomerang. false = skipped (no live view). */
  recordBoomerang(sessionId: string): Promise<boolean>
  finish(sessionId: string, photoPaths: string[], requestKey: string): Promise<FinishResult>
  reprint(sessionId: string, requestKey: string, copies: number): Promise<string>
  liveViewStart(): Promise<boolean>
  liveViewFrame(): Promise<string | null>
  liveViewStop(): Promise<void>
  /** Guest gallery: finished sessions of the active event (empty if the event hides the gallery). */
  galleryList(): Promise<{ id: string; createdAt: string; thumb: string; hasGif: boolean }[]>
  galleryItem(sessionId: string): Promise<{ image: string; gif?: string; colour?: string; boomerang?: string }>

  // admin
  listEvents(): Promise<BoothEvent[]>
  duplicateEvent(id: string): Promise<BoothEvent>
  eventStats(id: string): Promise<EventStats>
  /** Asks for a folder (e.g. a USB stick), copies the event's photos there and opens it. null if cancelled. */
  exportEventPhotos(eventId: string, originals: boolean): Promise<{ folder: string; prints: number; originals: number; missing: number } | null>
  hasPin(): Promise<boolean>
  verifyPin(pin: string): Promise<{ ok: boolean; lockedForSeconds?: number }>
  /** Set, change or remove (next = null) the operator PIN; needs the current PIN once one exists. */
  setPin(current: string | null, next: string | null): Promise<void>
  saveEvent(e: EventInput): Promise<BoothEvent>
  deleteEvent(id: string): Promise<void>
  setActiveEvent(id: string): Promise<void>
  listTemplates(): Promise<Template[]>
  /** look: preview the event's filter on the sample photos. */
  previewTemplate(templateId: string, eventName: string, look?: { look: Look; skinSmoothing: number }): Promise<string>
  chooseTemplateFile(): Promise<string | null>
  prepareTemplateImport(filePath: string, opts?: TemplateImportOptions): Promise<TemplateImportDraft>
  getTemplateArtwork(templateId: string): Promise<string | null>
  saveTemplate(t: Template): Promise<Template>
  deleteTemplate(id: string): Promise<void>
  discardTemplateDraft(id: string): Promise<void>
  previewTemplateDraft(t: Template, eventName: string): Promise<string>
  testPrintTemplate(t: Template): Promise<string>
  /** Local path of a file dropped onto the window (Electron no longer exposes File.path). */
  pathForFile(file: File): string
  listSessions(eventId: string): Promise<SessionRecord[]>
  openEventFolder(eventId: string): Promise<void>

  getDeviceSettings(): Promise<DeviceSettings>
  saveDeviceSettings(s: DeviceSettings): Promise<void>
  detectPrinters(): Promise<PrinterDetection>
  reconnectCamera(): Promise<void>
  getDevices(): Promise<DeviceSnapshot>
  onDevices(cb: (d: DeviceSnapshot) => void): () => void

  /** Shutter speeds faster than flash sync are never included. */
  getExposure(): Promise<ExposureState>
  /** Applies to the camera immediately and is remembered on `eventId` (default: the active event). */
  setExposure(key: ExposureKey, value: string, eventId?: string): Promise<ExposureState>
  /** Several settings at once (presets); each snapped to the nearest value the camera allows. */
  applyExposure(settings: ExposureSettings, eventId?: string): Promise<{ state: ExposureState; skipped: ExposureKey[] }>
  testShot(): Promise<TestShot>
  /** Exposure changed on the camera itself (dial, zoom) or was re-applied after a reconnect. */
  onExposure(cb: () => void): () => void

  listPrintJobs(): Promise<PrintJob[]>
  retryPrintJob(id: string): Promise<boolean>
  cancelPrintJob(id: string): Promise<boolean>
  markPrintJobPrinted(id: string): Promise<boolean>
  onPrintJobs(cb: () => void): () => void

  /** Licence: signing in opens the website in the browser, which hands back to the app. */
  accountState(): Promise<AccountState>
  accountSignIn(): Promise<void>
  /** The code shown on the website, when the browser couldn't open the app by itself. */
  accountRedeemCode(code: string): Promise<AccountState>
  accountRefresh(): Promise<AccountState>
  accountSignOut(): Promise<AccountState>
  openAccountWebsite(page: 'account' | 'pricing'): Promise<void>
  onAccount(cb: (s: AccountState) => void): () => void
  /** Sign-in finished in the browser but the website refused it (e.g. both computers already in use). */
  onAccountError(cb: (message: string) => void): () => void

  testPrint(format: '4x6' | '2x6'): Promise<string>
  /** The operator loaded a new roll with room for `capacity` prints. */
  newPaperRoll(capacity: number): Promise<PaperState>
  /** Shareable page with every photo of the event, for the host (link + QR image). */
  eventGalleryLink(eventId: string): Promise<{ url: string; qr: string }>
  /** Free bytes on the drive that holds the photos. */
  diskFree(): Promise<number>
  /** Phone remote on the local network: link + QR while on. */
  remoteInfo(): Promise<RemoteInfo>
  remoteSetEnabled(on: boolean): Promise<RemoteInfo>
  /** Replaces the secret link; phones holding the old one lose access. */
  remoteNewLink(): Promise<RemoteInfo>
  /** Pause / resume the guest screen (also from the phone remote). */
  setPaused(paused: boolean): Promise<void>
  onPaused(cb: (paused: boolean) => void): () => void
  /** Booth screen shown/hidden: applies the kiosk lock if it's on. */
  setBoothShowing(showing: boolean): Promise<void>
  appInfo(): Promise<{ version: string; dataDir: string; logFile: string }>
  quit(): Promise<void>
}
