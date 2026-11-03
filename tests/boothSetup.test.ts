import { describe, expect, it } from 'vitest'
import { buildSetup, readSetup, SETUP_VERSION } from '../src/shared/boothSetup'
import { BUILT_IN_TEMPLATES } from '../src/shared/templates'
import type { Template } from '../src/shared/types'

const imported: Template = { id: 'imported-0a1b2c3d', name: 'Wedding', format: '2x6', orientation: 'portrait', background: '#ffffff', overlayPath: '/Users/me/AppData/t.png', slots: [{ x: 10, y: 10, w: 300, h: 200 }], texts: [] }
const copy: Template = { ...BUILT_IN_TEMPLATES[0], id: 'classic-strip-3-copy-ab12cd', name: 'Mine' }
const pin = `${'a'.repeat(32)}:${'b'.repeat(64)}`

describe('buildSetup', () => {
  it('takes the operator’s templates (no file paths) and booth preferences, and the PIN only when asked', () => {
    const s = buildSetup({ templates: [imported, copy, BUILT_IN_TEMPLATES[1]], builtInIds: new Set(BUILT_IN_TEMPLATES.map((t) => t.id)), prefs: { kioskLock: true, pedalKey: 'KeyB' }, pinHash: pin, includePin: false, from: 'BOOTH-1', now: new Date('2026-11-03T10:00:00Z') })
    expect(s.version).toBe(SETUP_VERSION)
    expect(s.templates.map((t) => t.id)).toEqual(['imported-0a1b2c3d', 'classic-strip-3-copy-ab12cd'])
    expect('overlayPath' in s.templates[0]).toBe(false)
    expect(s.templates[0].artwork).toBe('over')
    expect(s.templates[1].artwork).toBeUndefined()
    expect(s.pinHash).toBeUndefined()
    expect(s).toMatchObject({ prefs: { kioskLock: true, pedalKey: 'KeyB' }, savedFrom: 'BOOTH-1', savedAt: '2026-11-03T10:00:00.000Z' })
    expect(buildSetup({ templates: [], builtInIds: new Set(), prefs: { kioskLock: false, pedalKey: 'auto' }, pinHash: pin, includePin: true, from: 'x' }).pinHash).toBe(pin)
  })
})

describe('readSetup', () => {
  const good = buildSetup({ templates: [imported, copy], builtInIds: new Set(), prefs: { kioskLock: true, pedalKey: 'auto' }, pinHash: pin, includePin: true, from: 'BOOTH-1' })

  it('accepts what buildSetup makes', () => {
    expect(readSetup(JSON.parse(JSON.stringify(good)))).toEqual(good)
  })

  it('refuses anything odd: other versions, built-in ids, bad ids, bad PINs, bad prefs', () => {
    expect(readSetup({ ...good, version: 99 })).toBeNull()
    expect(readSetup('nope')).toBeNull()
    const r = readSetup({
      ...good,
      templates: [...good.templates, { ...copy, id: 'classic-strip-3' }, { ...copy, id: '../../evil' }, { ...imported }, { ...imported, id: 'imported-11111111', artwork: 'sideways' }],
      pinHash: 'not-a-hash',
      prefs: { kioskLock: 'yes', pedalKey: '<script>' }
    })!
    expect(r.templates.map((t) => t.id)).toEqual(['imported-0a1b2c3d', 'classic-strip-3-copy-ab12cd', 'imported-11111111'])
    expect(r.templates[2].artwork).toBeUndefined()
    expect(r.pinHash).toBeUndefined()
    expect(r.prefs).toEqual({ kioskLock: true, pedalKey: 'auto' })
  })
})
