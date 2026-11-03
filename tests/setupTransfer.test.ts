import { describe, expect, it } from 'vitest'
import { SetupTransfer, type SetupDeps } from '../src/main/licence/setupTransfer'
import { BUILT_IN_TEMPLATES } from '../src/shared/templates'
import type { Template } from '../src/shared/types'

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('design')])
const pin = `${'a'.repeat(32)}:${'b'.repeat(64)}`
const imported: Template = { id: 'imported-0a1b2c3d', name: 'Wedding', format: '2x6', orientation: 'portrait', background: '#ffffff', overlayPath: '/a/imported-0a1b2c3d.png', slots: [{ x: 10, y: 10, w: 300, h: 200 }], texts: [] }
const drawn: Template = { ...BUILT_IN_TEMPLATES[0], id: 'classic-strip-3-copy-ab12cd', name: 'Mine', background: '#fde2e4' }

/** The website and its storage in memory, and two booth computers. */
function world() {
  const server: { setup?: unknown; files: Map<string, Buffer> } = { files: new Map() }
  const fakeFetch = (async (url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      server.files.set(url.replace('put:', ''), Buffer.from(init.body as Uint8Array))
      return new Response(null, { status: 200 })
    }
    const f = server.files.get(url.replace('get:', ''))
    return f ? new Response(new Uint8Array(f)) : new Response(null, { status: 404 })
  }) as typeof fetch
  const call = async <T,>(_p: string, body: Record<string, unknown> = {}) => {
    if (body.op === 'save') {
      server.setup = JSON.parse(JSON.stringify(body.setup))
      return { uploads: Object.fromEntries((body.artwork as string[]).map((id) => [id, { url: `put:${id}`, headers: {} }])) } as T
    }
    return { setup: server.setup ?? null, artwork: Object.fromEntries([...server.files.keys()].map((id) => [id, `get:${id}`])) } as T
  }
  const booth = (templates: Template[], prefs = { kioskLock: false, pedalKey: 'auto' }, pinHash?: string) => {
    const state = { templates: new Map(templates.map((t) => [t.id, t])), art: new Map<string, Buffer>(templates.filter((t) => t.overlayPath).map((t) => [t.id, png])), prefs, pinHash }
    const deps: SetupDeps = {
      call, fetch: fakeFetch, computerName: 'BOOTH', builtInIds: new Set(BUILT_IN_TEMPLATES.map((t) => t.id)),
      templates: () => [...state.templates.values()],
      readArtwork: async (id) => state.art.get(id)!,
      writeArtwork: async (id, b) => (state.art.set(id, b), `/b/${id}.png`),
      saveTemplate: (t) => state.templates.set(t.id, t),
      prefs: () => state.prefs, setPrefs: (p) => (state.prefs = p),
      pinHash: () => state.pinHash, setPinHash: (h) => (state.pinHash = h)
    }
    return { state, transfer: new SetupTransfer(deps) }
  }
  return { booth, server }
}

describe('copying a booth setup to another computer', () => {
  it('copies templates (with their artwork), preferences and the PIN', async () => {
    const w = world()
    const a = w.booth([imported, drawn], { kioskLock: true, pedalKey: 'KeyB' }, pin)
    const b = w.booth([])
    expect(await a.transfer.save(true)).toMatchObject({ templates: 2, hasPin: true })
    expect(await b.transfer.info()).toMatchObject({ templates: 2, hasPin: true, savedFrom: 'BOOTH' })
    const r = await b.transfer.copy({ templates: true, prefs: true, pin: true })
    expect(r).toEqual({ templates: 2, skipped: [], prefs: true, pin: true })
    expect(b.state.templates.get('imported-0a1b2c3d')?.overlayPath).toBe('/b/imported-0a1b2c3d.png')
    expect(b.state.art.get('imported-0a1b2c3d')?.equals(png)).toBe(true)
    expect(b.state.templates.get('classic-strip-3-copy-ab12cd')?.background).toBe('#fde2e4')
    expect(b.state.prefs).toEqual({ kioskLock: true, pedalKey: 'KeyB' })
    expect(b.state.pinHash).toBe(pin)
  })

  it('leaves the PIN out unless asked, and copies only what was ticked', async () => {
    const w = world()
    await w.booth([imported], { kioskLock: true, pedalKey: 'KeyB' }, pin).transfer.save(false)
    const b = w.booth([])
    const r = await b.transfer.copy({ templates: false, prefs: true, pin: true })
    expect(r).toMatchObject({ templates: 0, pin: false })
    expect(b.state.templates.size).toBe(0)
    expect(b.state.pinHash).toBeUndefined()
  })

  it('skips a template whose artwork is missing or not a PNG', async () => {
    const w = world()
    await w.booth([imported]).transfer.save(false)
    w.server.files.set('imported-0a1b2c3d', Buffer.from('<html>not a png</html>'))
    const r = await w.booth([]).transfer.copy({ templates: true, prefs: false, pin: false })
    expect(r).toMatchObject({ templates: 0, skipped: ['Wedding'] })
  })

  it('says so when nothing was saved yet', async () => {
    await expect(world().booth([]).transfer.copy({ templates: true, prefs: true, pin: false })).rejects.toThrow(/No setup saved yet/)
  })
})
