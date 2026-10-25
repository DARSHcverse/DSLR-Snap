import { describe, expect, it } from 'vitest'
import { BoothDatabase } from '../src/main/db/database'
import { BUILT_IN_TEMPLATES } from '../src/shared/templates'
import type { Template } from '../src/shared/types'

const imported = (id: string): Template => ({
  id, name: 'My Canva strip', format: '2x6', orientation: 'portrait', background: '#ffffff',
  overlayPath: `/tmp/${id}.png`, slots: [{ x: 60, y: 60, w: 500, h: 450 }], texts: []
})

describe('template library', () => {
  it('saves and deletes an imported template', () => {
    const db = new BoothDatabase(':memory:')
    db.saveTemplate(imported('imported-aaaa1111'))
    expect(db.getTemplate('imported-aaaa1111')?.name).toBe('My Canva strip')
    db.deleteTemplate('imported-aaaa1111')
    expect(db.getTemplate('imported-aaaa1111')).toBeUndefined()
  })

  it('refuses to delete a built-in template', () => {
    const db = new BoothDatabase(':memory:')
    expect(() => db.deleteTemplate(BUILT_IN_TEMPLATES[0].id)).toThrow(/built-in/i)
  })

  it('stores camera exposure with the event, and leaves it unset for events without one', () => {
    const db = new BoothDatabase(':memory:')
    const base = { date: '2026-10-24', templateId: 'classic-strip-3', photosPerSession: 3, countdownSeconds: 3, retakesAllowed: 1, printCopies: 1, autoPrint: true, galleryEnabled: false }
    const plain = db.saveEvent({ ...base, name: 'Plain' })
    expect(db.getEvent(plain.id)?.exposure).toBeUndefined()
    const lit = db.saveEvent({ ...base, name: 'Lit', exposure: { iso: '400', aperture: '5.6', shutter: '1/125', whiteBalance: 'Flash' } })
    expect(db.getEvent(lit.id)?.exposure).toEqual({ iso: '400', aperture: '5.6', shutter: '1/125', whiteBalance: 'Flash' })
    db.saveEventExposure(lit.id, { iso: '800' })
    expect(db.getEvent(lit.id)?.exposure).toEqual({ iso: '800' })
    // Saving the event form later with its stale copy must not undo the Camera screen's change.
    const saved = db.saveEvent({ ...lit, name: 'Lit renamed' })
    expect(saved.exposure).toEqual({ iso: '800' })
    expect(db.getEvent(lit.id)?.exposure).toEqual({ iso: '800' })
  })

  it('refuses to delete a template an event is using, and names the event', () => {
    const db = new BoothDatabase(':memory:')
    db.saveTemplate(imported('imported-bbbb2222'))
    db.saveEvent({ name: 'Sarah & Tom', date: '2026-10-24', templateId: 'imported-bbbb2222', photosPerSession: 1, countdownSeconds: 3, retakesAllowed: 1, printCopies: 1, autoPrint: true, galleryEnabled: false })
    expect(() => db.deleteTemplate('imported-bbbb2222')).toThrow(/Sarah & Tom/)
  })
})
