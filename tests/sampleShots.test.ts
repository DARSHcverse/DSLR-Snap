import { mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { createSampleShots } from '../src/main/compose/sampleShots'

describe('sample shots for template previews', () => {
  // Regression: the Templates screen previews every template at once. Each call used to make its own
  // MockCamera, so parallel calls wrote IMG_0001_<same ms>.jpg over each other while compose was reading it
  // ("Corrupt JPEG data", and a SIGBUS crash in libvips on macOS).
  it('serves many parallel previews from one set of files that are written once', async () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'samples-')), 'template-previews')
    const sampleShots = createSampleShots(dir)

    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => sampleShots(1 + (i % 4))))

    expect(readdirSync(dir)).toHaveLength(4)
    for (const paths of results) {
      for (const p of paths) {
        const meta = await sharp(p).metadata()
        expect(meta.width).toBeGreaterThan(0)
      }
    }
    expect(results[3]).toHaveLength(4)
    expect(new Set(results[3]).size).toBe(4)
  })

  it('repeats photos when a layout has more slots than samples', async () => {
    const sampleShots = createSampleShots(join(mkdtempSync(join(tmpdir(), 'samples-')), 'previews'))
    const paths = await sampleShots(6)
    expect(paths).toHaveLength(6)
    expect(paths[4]).toBe(paths[0])
  })

  it('clears leftovers from earlier runs', async () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'samples-')), 'previews')
    await createSampleShots(dir)(4)
    await createSampleShots(dir)(4)
    expect(readdirSync(dir)).toHaveLength(4)
  })
})
