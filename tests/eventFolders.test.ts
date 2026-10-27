import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { eventFolderName, layoutFromFinal, safeFolderName, sessionLayout, sessionStamp } from '../src/main/eventFolders'

describe('event folders', () => {
  it('names the folder after the event and date, made safe for Windows', () => {
    expect(eventFolderName({ name: 'Priya & Tom', date: '2026-10-31' }, () => false)).toBe('Priya & Tom 2026-10-31')
    expect(safeFolderName('Acme: Q4 "Gala" / Party?. ')).toBe('Acme Q4 Gala Party')
    expect(safeFolderName('???')).toBe('Event')
  })

  it("adds (2), (3)… when another event already has the folder", () => {
    const taken = new Set(['Gala 2026-11-14', 'Gala 2026-11-14 (2)'])
    expect(eventFolderName({ name: 'Gala', date: '2026-11-14' }, (n) => taken.has(n))).toBe('Gala 2026-11-14 (3)')
  })

  it('stamps sessions with the local time, without colons', () => {
    const iso = new Date(2026, 9, 31, 20, 4, 5).toISOString()
    expect(sessionStamp(iso)).toBe('20.04.05')
  })

  it('lays a session out in Photos / Prints / GIFs / Boomerangs, with app files in .booth', () => {
    const l = sessionLayout(join('/x', 'Gala 2026-11-14'), '20.04.05')
    expect(l.original(2)).toBe(join('/x', 'Gala 2026-11-14', 'Photos', '20.04.05 2.jpg'))
    expect(l.final).toBe(join('/x', 'Gala 2026-11-14', 'Prints', '20.04.05.jpg'))
    expect(l.colour).toBe(join('/x', 'Gala 2026-11-14', 'Prints', '20.04.05 colour.jpg'))
    expect(l.gif).toBe(join('/x', 'Gala 2026-11-14', 'GIFs', '20.04.05.gif'))
    expect(l.boomerang).toBe(join('/x', 'Gala 2026-11-14', 'Boomerangs', '20.04.05.gif'))
    expect(l.printSheet).toBe(join('/x', 'Gala 2026-11-14', '.booth', '20.04.05 print-sheet.jpg'))
  })

  it('finds the other files from the final design, for new and old sessions', () => {
    const l = sessionLayout(join('/x', 'Gala 2026-11-14'), '20.04.05')
    const { original: _o, photosDir: _p, ...rest } = l
    expect(layoutFromFinal(l.final)).toEqual(rest)
    const old = join('/x', 'events', 'e1', 's1', 'final.jpg')
    expect(layoutFromFinal(old).gif).toBe(join('/x', 'events', 'e1', 's1', 'animation.gif'))
    expect(layoutFromFinal(old).thumb).toBe(join('/x', 'events', 'e1', 's1', 'thumb.jpg'))
  })
})
