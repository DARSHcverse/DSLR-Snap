import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { applyLook } from '../src/main/compose/looks'

const W = 400
const H = 200

/** Left half: mid-grey "skin" with fine noise. Right half: a hard black/white edge (an outline, an eye). */
async function testCard(): Promise<Buffer> {
  const px = Buffer.alloc(W * H * 3)
  let seed = 7
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3
      const v = x < W / 2 ? 150 + Math.round((rand() - 0.5) * 14) : x < (W * 3) / 4 ? 20 : 235
      px[i] = v + 10 // a little warmth so B&W conversion is visible
      px[i + 1] = v
      px[i + 2] = v - 10
    }
  }
  return sharp(px, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer()
}

async function region(img: Buffer, left: number, width: number) {
  const crop = await sharp(img).extract({ left, top: 20, width, height: H - 40 }).toBuffer()
  return (await sharp(crop).stats()).channels
}

describe('applyLook', () => {
  it('leaves colour photos untouched', async () => {
    const card = await testCard()
    expect(await applyLook(card, 'colour')).toBe(card)
  })

  it('glam is black and white, same size, ready to composite (3 channels)', async () => {
    const out = await applyLook(await testCard(), 'glam')
    const meta = await sharp(out).metadata()
    expect([meta.width, meta.height, meta.channels]).toEqual([W, H, 3])
    const [r, g, b] = await region(out, 20, 100)
    expect(Math.abs(r.mean - b.mean)).toBeLessThan(1)
    expect(Math.abs(r.mean - g.mean)).toBeLessThan(1)
  })

  it('glam smooths skin texture but keeps edges sharp', async () => {
    const card = await testCard()
    const off = await applyLook(card, 'glam', { skinSmoothing: 0 })
    const strong = await applyLook(card, 'glam', { skinSmoothing: 100 })
    const noise = async (img: Buffer) => (await region(img, 30, 140))[0].stdev
    expect(await noise(strong)).toBeLessThan((await noise(off)) * 0.5)
    // Edge between the dark and bright bands stays crisp: compare pixels 3 px either side of it.
    const edgeAt = (W * 3) / 4
    const dark = (await region(strong, edgeAt - 6, 3))[0].mean
    const bright = (await region(strong, edgeAt + 3, 3))[0].mean
    expect(bright - dark).toBeGreaterThan(150)
  })

  it('classic B&W is greyscale with more contrast than glam', async () => {
    const card = await testCard()
    const bw = await applyLook(card, 'bw')
    const glam = await applyLook(card, 'glam')
    const [r, , b] = await region(bw, 20, 100)
    expect(Math.abs(r.mean - b.mean)).toBeLessThan(1)
    const spread = async (img: Buffer) => (await region(img, W / 2 + 10, W / 2 - 20))[0].stdev
    expect(await spread(bw)).toBeGreaterThan(await spread(glam))
  })

  it('warm and vintage shift colour towards red/yellow', async () => {
    const card = await testCard()
    const balance = async (img: Buffer) => {
      const [r, , b] = await region(img, 20, 100)
      return r.mean - b.mean
    }
    const base = await balance(card)
    expect(await balance(await applyLook(card, 'warm'))).toBeGreaterThan(base + 5)
    expect(await balance(await applyLook(card, 'vintage'))).toBeGreaterThan(base + 5)
  })
})
