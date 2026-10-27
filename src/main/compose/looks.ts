import sharp from 'sharp'
import type { Look } from '../../shared/types'

/**
 * Event looks, applied to each photo after it is cropped to its slot (so the work scales with the
 * print, not the 24 MP original). Originals on disk are never changed.
 */
export async function applyLook(input: Buffer, look: Look, opts: { skinSmoothing?: number } = {}): Promise<Buffer> {
  switch (look) {
    case 'glam':
      return glam(input, opts.skinSmoothing ?? 50)
    case 'bw':
      return sharp(input).greyscale().linear(1.15, -128 * 0.15).toColourspace('srgb').jpeg({ quality: 95 }).toBuffer()
    case 'warm':
      return sharp(input)
        .recomb([
          [1.08, 0.02, 0],
          [0.01, 1.0, 0],
          [0, 0, 0.88]
        ])
        .modulate({ saturation: 1.05 })
        .jpeg({ quality: 95 })
        .toBuffer()
    case 'vintage':
      // 40% sepia, then faded blacks.
      return sharp(input)
        .recomb([
          [0.757, 0.308, 0.076],
          [0.14, 0.874, 0.067],
          [0.109, 0.214, 0.652]
        ])
        .linear(0.88, 20)
        .modulate({ saturation: 0.85 })
        .jpeg({ quality: 95 })
        .toBuffer()
    default:
      return input
  }
}

/** Gentle S-curve with lifted blacks and brighter mid-tones: the soft, bright glam-booth tone. */
const GLAM_CURVE = (() => {
  const lut = new Uint8Array(256)
  for (let x = 0; x < 256; x++) {
    const t = Math.pow(x / 255, 0.9)
    const s = t * t * (3 - 2 * t)
    lut[x] = Math.round(255 * (0.04 + 0.95 * (0.55 * t + 0.45 * s)))
  }
  return lut
})()

/** How different a pixel may be from its surroundings and still count as smooth skin, not an edge. */
const EDGE_THRESHOLD = 22
const GLOW = 0.18

/**
 * Glam black and white. Skin smoothing is an edge-preserving blur: flat areas (skin) take the
 * blurred value, while pixels that differ a lot from their surroundings (eyes, lips, hair, outlines)
 * keep their detail. Then the soft tone curve, then a faint highlight glow (screen blend).
 */
async function glam(input: Buffer, skinSmoothing: number): Promise<Buffer> {
  const { data: g, info } = await sharp(input).greyscale().toColourspace('b-w').raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info
  const raw = { raw: { width: w, height: h, channels: 1 as const } }
  // extractChannel: sharp otherwise writes a blurred grey image back out as 3-channel sRGB.
  const [soft, glow] = await Promise.all([
    sharp(g, raw).blur(Math.max(1, w / 260)).extractChannel(0).raw().toBuffer(),
    sharp(g, raw).blur(Math.max(2, w / 60)).extractChannel(0).raw().toBuffer()
  ])
  const amount = Math.min(100, Math.max(0, skinSmoothing)) / 100
  const out = Buffer.alloc(w * h)
  for (let i = 0; i < out.length; i++) {
    const weight = amount * Math.max(0, 1 - Math.abs(g[i] - soft[i]) / EDGE_THRESHOLD)
    const v = GLAM_CURVE[Math.round(g[i] + (soft[i] - g[i]) * weight)]
    const screen = 255 - ((255 - v) * (255 - glow[i])) / 255
    out[i] = Math.round(v + (screen - v) * GLOW)
  }
  return sharp(out, raw).toColourspace('srgb').jpeg({ quality: 95 }).toBuffer()
}
