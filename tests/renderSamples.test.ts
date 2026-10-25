import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MockCamera } from '../src/main/camera/MockCamera'
import { compose } from '../src/main/compose/composer'
import { BUILT_IN_TEMPLATES } from '../src/shared/templates'

/** Writes every built-in layout to samples-output/ so you can eyeball designs and print sheets. */
describe('render samples', () => {
  it('renders all built-in templates', async () => {
    const out = join(__dirname, '..', 'samples-output')
    mkdirSync(out, { recursive: true })
    const cam = new MockCamera({ w: 1500, h: 1000 })
    await cam.connect()
    const shots: string[] = []
    for (let i = 0; i < 4; i++) shots.push(await cam.capture(join(out, 'shots')))
    for (const t of BUILT_IN_TEMPLATES) {
      const r = await compose({ template: t, photoPaths: shots, eventName: 'Priya & Tom', date: new Date('2026-10-24') })
      writeFileSync(join(out, `${t.id}-design.jpg`), r.composite)
      writeFileSync(join(out, `${t.id}-print-sheet.jpg`), r.printSheet)
    }
    expect(true).toBe(true)
  })
})
