import { describe, expect, it } from 'vitest'
import { PresetSync } from '../src/main/licence/presetSync'
import type { SavedPreset } from '../src/shared/types'

const p = (name: string, iso = '400'): SavedPreset => ({ id: `id-${name}`, name, settings: { iso } })

/** Two booth computers and the website, in memory. */
function world(signedIn = true) {
  let account: SavedPreset[] = []
  let calls = 0
  const booth = (initial: SavedPreset[]) => {
    let presets = initial
    const kv = new Map<string, string>()
    const sync = new PresetSync({
      call: async <T,>(_path: string, body: Record<string, unknown> = {}) => {
        if (!signedIn) return null
        calls++
        if (body.cameraPresets) account = body.cameraPresets as SavedPreset[]
        return { cameraPresets: account } as T
      },
      getPresets: () => presets,
      setPresets: (l) => (presets = l),
      store: { get: (k) => kv.get(k), set: (k, v) => (v === null ? kv.delete(k) : kv.set(k, v)) }
    })
    return { sync, get presets() { return presets }, set presets(l: SavedPreset[]) { presets = l } }
  }
  return { booth, get account() { return account }, get calls() { return calls } }
}

describe('PresetSync', () => {
  it('a preset saved on one booth appears on the other', async () => {
    const w = world()
    const a = w.booth([])
    const b = w.booth([])
    a.presets = [p('Ballroom')]
    await a.sync.changed()
    await b.sync.sync()
    expect(b.presets.map((x) => x.name)).toEqual(['Ballroom'])
  })

  it('a delete on one booth removes it from the other', async () => {
    const w = world()
    const a = w.booth([p('Ballroom'), p('Garden')])
    const b = w.booth([])
    await a.sync.changed()
    await b.sync.sync()
    a.presets = [p('Garden')]
    await a.sync.changed()
    await b.sync.sync()
    expect(b.presets.map((x) => x.name)).toEqual(['Garden'])
    expect(w.account.map((x) => x.name)).toEqual(['Garden'])
  })

  it('edits made offline are sent later and win', async () => {
    const w = world()
    const a = w.booth([p('Hall', '200')])
    await a.sync.changed()
    a.presets = [p('Hall', '800')]
    await a.sync.changed()
    expect(w.account[0].settings.iso).toBe('800')
  })

  it('does nothing while signed out', async () => {
    const w = world(false)
    const a = w.booth([p('X')])
    await a.sync.changed()
    expect(a.presets).toHaveLength(1)
    expect(w.calls).toBe(0)
  })
})
