// Types shared by main process, preload and renderer.

export type PrintFormat = '4x6' | '2x6'
export type Orientation = 'portrait' | 'landscape'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface TextItem {
  /** Supports tokens: {event} {date} {time} */
  text: string
  x: number
  y: number
  size: number
  color: string
  fontFamily?: string
  weight?: 'normal' | 'bold'
  align?: 'start' | 'middle' | 'end'
}

export interface Template {
  id: string
  name: string
  format: PrintFormat
  /** 2x6 strips are always portrait. */
  orientation: Orientation
  background: string
  /** Absolute path to a transparent PNG sized to the design canvas. Drawn on top of photos. */
  overlayPath?: string
  /** Absolute path to an image sized to the design canvas. Drawn behind photos (designs without transparency). */
  backgroundPath?: string
  logo?: Rect & { path: string }
  slots: Rect[]
  texts: TextItem[]
}

/** How an imported design is fitted to the print canvas. */
export type FitMode = 'stretch' | 'fit' | 'fill'

/** Choices the operator can override when importing; anything left out is guessed from the image. */
export interface TemplateImportOptions {
  /** Re-use the artwork file of an import in progress instead of creating another one. */
  draftId?: string
  format?: PrintFormat
  orientation?: Orientation
  fit?: FitMode
}

export interface TemplateImportDraft {
  /** Unsaved template; its artwork file already exists in the app's template folder. */
  template: Template
  /** Small preview of the fitted artwork for the editor. */
  artwork: string
  source: { fileName: string; width: number; height: number }
  fit: FitMode
  /** How the photo boxes were found: see-through holes, flat placeholder boxes, or not at all (defaults used). */
  detection: 'transparent' | 'placeholder' | 'none'
  notes: string[]
}

export interface BoothEvent {
  id: string
  name: string
  date: string // ISO date
  templateId: string
  photosPerSession: number
  countdownSeconds: number
  retakesAllowed: number
  printCopies: number
  autoPrint: boolean
  galleryEnabled: boolean
  /** Countdown before photos 2, 3… and before a retake (countdownSeconds is before the first photo). */
  shotIntervalSeconds: number
  /** How long each photo is shown after it's taken, with a Retake button; 0 = not shown. */
  photoReviewSeconds: number
  /** How long the final "printing" screen stays before returning to "Tap to start". */
  doneScreenSeconds: number
  /** Guests can browse this event's photos and GIFs from the welcome screen. */
  showGallery: boolean
  /** Camera exposure for this venue; applied whenever the camera connects. */
  exposure?: ExposureSettings
  createdAt: string
}

export interface EventStats {
  /** Completed guest sessions. */
  sessions: number
  /** sent counts sheets (copies); pending and failed count jobs. Failed includes "check printer". */
  prints: { sent: number; pending: number; failed: number; lastError?: string }
  uploads: { done: number; pending: number; failed: number; lastError?: string }
}

/** Fields added after the first release; optional when saving so older callers keep working. */
type NewerEventFields = 'shotIntervalSeconds' | 'photoReviewSeconds' | 'doneScreenSeconds' | 'showGallery'
export type EventInput = Omit<BoothEvent, 'id' | 'createdAt' | NewerEventFields> & Partial<Pick<BoothEvent, NewerEventFields>> & { id?: string }

export type ExposureKey = 'iso' | 'aperture' | 'shutter' | 'whiteBalance'

/** Human labels as the camera shows them: iso "400", aperture "5.6", shutter "1/125", whiteBalance "Flash". */
export type ExposureSettings = Partial<Record<ExposureKey, string>>

export interface ExposureState {
  /** Mode dial position, e.g. "M", "Av", "Auto". */
  mode: string
  /** Only in M can the app set ISO, aperture and shutter together. */
  manual: boolean
  current: ExposureSettings
  /** Values the camera accepts right now; empty means "not adjustable in this mode". */
  options: Record<ExposureKey, string[]>
}

export interface TestShot {
  path: string
  /** Large JPEG data URL for checking focus and exposure. */
  preview: string
  settings: ExposureSettings
  /** 64 luminance bins, fractions summing to 1. */
  histogram: number[]
  /** Mean luminance 0–255. */
  brightness: number
  verdict: 'dark' | 'good' | 'bright'
  takenAt: string
}

export type SessionStatus = 'capturing' | 'composed' | 'complete' | 'abandoned'

export interface SessionRecord {
  id: string
  eventId: string
  status: SessionStatus
  photoPaths: string[]
  compositePath?: string
  printPath?: string
  gifPath?: string
  galleryUrl?: string
  createdAt: string
}

export type PrintJobStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'needs_check' | 'cancelled'

export interface PrintJob {
  id: string
  sessionId: string
  filePath: string
  format: PrintFormat
  copies: number
  status: PrintJobStatus
  attempts: number
  lastError?: string
  createdAt: string
  updatedAt: string
}

export type UploadStatus = 'pending' | 'uploading' | 'done' | 'failed'

export interface UploadJob {
  id: string
  sessionId: string
  filePath: string
  status: UploadStatus
  attempts: number
  nextAttemptAt: string
  url?: string
  lastError?: string
}

export type DeviceState = 'disconnected' | 'connecting' | 'ready' | 'busy' | 'error'

export interface CameraStatus {
  driver: 'mock' | 'canon-edsdk'
  state: DeviceState
  model?: string
  message?: string
  liveViewSupported: boolean
}

export interface PrinterStatus {
  driver: 'mock' | 'windows-driver'
  state: DeviceState
  printerName?: string
  message?: string
  queueLength: number
}

export interface DeviceSettings {
  cameraDriver: 'mock' | 'canon-edsdk'
  printerDriver: 'mock' | 'windows-driver'
  /** Windows printer queue whose default preferences are 4x6 (no cut). */
  printerName4x6: string
  /**
   * A second Windows queue for the same DNP printer whose default preferences are
   * 4x6 with the "2 inch cut" option. Chromium printing can't pick DNP cut modes itself,
   * so each format gets its own queue. See docs/HARDWARE_SETUP.md.
   */
  printerName2x6: string
}

export interface CaptureResult {
  path: string
  /** Small preview as data URL for the review screen. */
  preview: string
}

export interface FinishResult {
  session: SessionRecord
  printPreview: string
  qrDataUrl?: string
  printJobId?: string
}
