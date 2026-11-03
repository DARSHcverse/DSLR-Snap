import { mergePresets } from '../../shared/exposure'
import type { SavedPreset } from '../../shared/types'

const KEY = { synced: 'presetsSynced', dirty: 'presetsDirty' } as const

export interface PresetSyncDeps {
  /** AccountService.call: null when the booth isn't signed in. */
  call: <T>(path: string, body?: Record<string, unknown>) => Promise<T | null>
  getPresets: () => SavedPreset[]
  setPresets: (list: SavedPreset[]) => void
  store: { get: (k: string) => string | undefined; set: (k: string, v: string | null) => void }
  log?: (level: 'info' | 'warn', m: string) => void
}

/**
 * Keeps "My settings" the same on every booth computer signed in to the account. Changes made here
 * are marked unsent until the website has them, so working offline is fine: the next sync sends
 * them, and they win over the account's copy. See mergePresets for how deletes are told apart.
 */
export class PresetSync {
  private running: Promise<void> | null = null
  private again = false

  constructor(private deps: PresetSyncDeps) {}

  /** The operator saved or deleted a preset on this computer. */
  changed(): Promise<void> {
    this.deps.store.set(KEY.dirty, '1')
    return this.sync()
  }

  /** Brings both sides in line; calls during a sync run once more afterwards. */
  sync(): Promise<void> {
    if (this.running) {
      this.again = true
      return this.running
    }
    this.running = this.run().finally(() => {
      this.running = null
      if (this.again) {
        this.again = false
        void this.sync()
      }
    })
    return this.running
  }

  private async run(): Promise<void> {
    const { call, store } = this.deps
    try {
      const remote = await call<{ cameraPresets: SavedPreset[] }>('/api/app/settings')
      if (!remote) return // signed out: they stay on this computer only
      const local = this.deps.getPresets()
      const dirty = store.get(KEY.dirty) === '1'
      const synced = JSON.parse(store.get(KEY.synced) ?? '[]') as string[]
      const merged = mergePresets(local, remote.cameraPresets, synced, dirty ? 'local' : 'account')
      if (!same(merged, remote.cameraPresets)) await call('/api/app/settings', { cameraPresets: merged })
      if (!same(merged, local)) this.deps.setPresets(merged)
      store.set(KEY.synced, JSON.stringify(merged.map((p) => p.name.toLowerCase())))
      store.set(KEY.dirty, null)
    } catch (e) {
      this.deps.log?.('warn', `camera settings sync: ${e instanceof Error ? e.message : e}`)
    }
  }
}

const same = (a: SavedPreset[], b: SavedPreset[]) => JSON.stringify(a) === JSON.stringify(b)
