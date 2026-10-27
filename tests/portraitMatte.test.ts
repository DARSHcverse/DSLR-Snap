import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { setPortraitModel } from '../src/main/compose/aiModel'
import { compose } from '../src/main/compose/composer'
import { inputSize, PortraitMatter, toTensorData } from '../src/main/compose/portraitMatte'
import { BUILT_IN_TEMPLATES } from '../src/shared/templates'

const MODEL = join(__dirname, '..', 'resources', 'models', 'modnet.onnx')

describe('AI cut-out preparation', () => {
  it('sizes the model input: short edge 512, multiples of 32, aspect kept', () => {
    expect(inputSize(6000, 4000)).toEqual({ w: 768, h: 512 })
    expect(inputSize(4000, 6000)).toEqual({ w: 512, h: 768 })
    expect(inputSize(960, 640, 256)).toEqual({ w: 384, h: 256 })
  })

  it('scales pixels to [-1, 1] in channel planes (R plane, then G, then B)', () => {
    // Two pixels: (0, 255, 127) and (255, 0, 0)
    const t = Array.from(toTensorData(Uint8Array.from([0, 255, 127, 255, 0, 0]), 2, 1))
    const expected = [-1, 1, 1, -1, 127 / 127.5 - 1, -1]
    t.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 5))
  })
})

describe.skipIf(!existsSync(MODEL))('AI cut-out model (npm run fetch-models)', () => {
  it('returns a soft matte at the photo size', async () => {
    const photo = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#7a8090' } }).jpeg().toBuffer()
    const { alpha, width, height } = await new PortraitMatter(MODEL).matte(photo)
    expect([width, height, alpha.length]).toEqual([900, 600, 900 * 600])
  })
})

describe('AI backgrounds without the model', () => {
  it('say so clearly instead of printing a broken photo', async () => {
    setPortraitModel('/nonexistent/modnet.onnx')
    const t = BUILT_IN_TEMPLATES.find((x) => x.id === 'classic-strip-3')!
    const photo = join(mkdtempSync(join(tmpdir(), 'ai-')), 'p.jpg')
    await sharp({ create: { width: 600, height: 400, channels: 3, background: '#888888' } }).jpeg().toFile(photo)
    await expect(compose({ template: t, photoPaths: [photo, photo, photo], eventName: 'E', background: { path: 'x.jpg', key: 'ai' } })).rejects.toThrow(/AI model/)
  })
})
