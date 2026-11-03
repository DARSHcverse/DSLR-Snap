import { buildSetup, readSetup, type BoothSetup } from '../../shared/boothSetup'
import { sanitizeTemplate } from '../../shared/templateEdit'
import type { Template } from '../../shared/types'

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47])

export interface SetupDeps {
  /** AccountService.call: null when signed out. */
  call: <T>(path: string, body?: Record<string, unknown>) => Promise<T | null>
  fetch?: typeof fetch
  computerName: string
  templates: () => Template[]
  builtInIds: Set<string>
  readArtwork: (id: string) => Promise<Buffer>
  writeArtwork: (id: string, png: Buffer) => Promise<string>
  saveTemplate: (t: Template) => void
  prefs: () => { kioskLock: boolean; pedalKey: string }
  setPrefs: (p: { kioskLock: boolean; pedalKey: string }) => void
  pinHash: () => string | undefined
  setPinHash: (h: string) => void
}

export interface SetupInfo {
  savedFrom: string
  savedAt: string
  templates: number
  hasPin: boolean
}

const signedOut = () => new Error('Sign in under Account first.')

/**
 * "Save this computer's setup to my account" and "Copy setup to this computer". Templates keep
 * their ids, so copying again updates them instead of making duplicates.
 */
export class SetupTransfer {
  constructor(private deps: SetupDeps) {}

  async info(): Promise<SetupInfo | null> {
    const res = await this.deps.call<{ setup: unknown }>('/api/app/setup', { op: 'get' })
    const setup = res && readSetup(res.setup)
    return setup ? { savedFrom: setup.savedFrom, savedAt: setup.savedAt, templates: setup.templates.length, hasPin: !!setup.pinHash } : null
  }

  async save(includePin: boolean): Promise<SetupInfo> {
    const { deps } = this
    const setup = buildSetup({ templates: deps.templates(), builtInIds: deps.builtInIds, prefs: deps.prefs(), pinHash: deps.pinHash(), includePin, from: deps.computerName })
    const withArt = setup.templates.filter((t) => t.artwork).map((t) => t.id)
    const res = await deps.call<{ uploads: Record<string, { url: string; headers: Record<string, string> }> }>('/api/app/setup', { op: 'save', setup, artwork: withArt })
    if (!res) throw signedOut()
    for (const id of withArt) {
      const up = res.uploads[id]
      if (!up) continue
      const put = await (deps.fetch ?? fetch)(up.url, {
        method: 'PUT',
        headers: { ...up.headers, 'content-type': 'image/png', 'x-upsert': 'true' },
        body: new Uint8Array(await deps.readArtwork(id)),
        signal: AbortSignal.timeout(120_000)
      })
      if (!put.ok) throw new Error(`Couldn't upload the design for "${setup.templates.find((t) => t.id === id)?.name}" (${put.status}). Try again.`)
    }
    return { savedFrom: setup.savedFrom, savedAt: setup.savedAt, templates: setup.templates.length, hasPin: !!setup.pinHash }
  }

  async copy(what: { templates: boolean; prefs: boolean; pin: boolean }): Promise<{ templates: number; skipped: string[]; prefs: boolean; pin: boolean }> {
    const { deps } = this
    const res = await deps.call<{ setup: unknown; artwork: Record<string, string> }>('/api/app/setup', { op: 'get' })
    if (!res) throw signedOut()
    const setup: BoothSetup | null = readSetup(res.setup)
    if (!setup) throw new Error('No setup saved yet. On your other computer, press "Save this computer’s setup" first.')
    let templates = 0
    const skipped: string[] = []
    if (what.templates) {
      for (const t of setup.templates) {
        if (!t.artwork) {
          deps.saveTemplate(sanitizeTemplate(t as Template))
          templates++
          continue
        }
        const url = res.artwork?.[t.id]
        const got = url ? await (deps.fetch ?? fetch)(url, { signal: AbortSignal.timeout(120_000) }).catch(() => null) : null
        const png = got?.ok ? Buffer.from(await got.arrayBuffer()) : null
        if (!png || !png.subarray(0, 4).equals(PNG)) {
          skipped.push(t.name)
          continue
        }
        const path = await deps.writeArtwork(t.id, png)
        const placed = { ...(t as Template), ...(t.artwork === 'over' ? { overlayPath: path } : { backgroundPath: path }) }
        deps.saveTemplate(sanitizeTemplate(placed, { artworkPath: path }))
        templates++
      }
    }
    if (what.prefs) deps.setPrefs(setup.prefs)
    const pin = what.pin && !!setup.pinHash
    if (pin) deps.setPinHash(setup.pinHash!)
    return { templates, skipped, prefs: what.prefs, pin }
  }
}
