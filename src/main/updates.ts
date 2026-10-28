import { EventEmitter } from 'node:events'
import { autoUpdater } from 'electron-updater'
import { CHECK_EVERY_MS, shouldCheckForUpdates, type UpdateStatus } from '../shared/updates'

/**
 * Background updates from downloads.dslrsnap.com (electron-builder.yml → publish). Downloads quietly,
 * installs when the app closes; installNow() is only called once installBlocker() says it's safe.
 */
export class Updates extends EventEmitter {
  private status: UpdateStatus = { state: 'off' }
  private lastCheck: number | null = null
  private timer: NodeJS.Timeout | undefined

  constructor(private packaged: boolean, private log: (level: 'info' | 'warn', msg: string) => void) {
    super()
  }

  start(): void {
    if (!this.packaged) return
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.on('checking-for-update', () => this.set({ state: 'checking' }))
    autoUpdater.on('update-not-available', () => this.set({ state: 'idle', checkedAt: Date.now() }))
    autoUpdater.on('update-available', (i) => this.set({ state: 'downloading', version: i.version, percent: 0 }))
    autoUpdater.on('download-progress', (p) => {
      if (this.status.state === 'downloading') this.set({ ...this.status, percent: Math.round(p.percent) })
    })
    autoUpdater.on('update-downloaded', (i) => {
      this.log('info', `Update ${i.version} downloaded; installs when DSLR Snap closes`)
      this.set({ state: 'ready', version: i.version })
    })
    autoUpdater.on('error', (e) => {
      this.log('warn', `Update check failed: ${e.message}`)
      // Offline at a venue is normal: stay quiet and try again later, unless one is already waiting.
      if (this.status.state !== 'ready') this.set({ state: 'idle', checkedAt: this.lastCheck })
    })
    this.set({ state: 'idle', checkedAt: null })
    setTimeout(() => this.check(), 60_000) // let the booth finish starting first
    this.timer = setInterval(() => this.check(), CHECK_EVERY_MS / 6)
  }

  /** Looks for an update unless one was checked recently or is already downloaded. */
  check(force = false): void {
    if (!this.packaged || this.status.state === 'ready' || this.status.state === 'downloading') return
    if (!force && !shouldCheckForUpdates({ packaged: this.packaged, lastCheck: this.lastCheck, now: Date.now() })) return
    this.lastCheck = Date.now()
    autoUpdater.checkForUpdates().catch(() => undefined) // reported through the 'error' event
  }

  state(): UpdateStatus {
    return this.status
  }

  installNow(): void {
    if (this.status.state !== 'ready') return
    autoUpdater.quitAndInstall(true, true) // silent install, then reopen DSLR Snap
  }

  stop(): void {
    clearInterval(this.timer)
  }

  private set(s: UpdateStatus): void {
    this.status = s
    this.emit('changed', s)
  }
}
