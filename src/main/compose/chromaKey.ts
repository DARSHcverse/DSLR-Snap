import sharp from 'sharp'

import { type KeyColour, keyAlpha } from '../../shared/chroma'

export { type KeyColour, keyAlpha }

/**
 * Replaces a green/blue backdrop with the event's background (a client's branded artwork).
 * The background fills the photo ("cover"); edges are softened and green spill on hair and
 * shoulders is neutralised, so the person doesn't glow green.
 */
export async function keyOntoBackground(photo: Buffer, backgroundPath: string, key: KeyColour): Promise<Buffer> {
  const { data, info } = await sharp(photo).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info
  const alpha = Buffer.alloc(w * h)
  const fg = Buffer.from(data)
  for (let i = 0, p = 0; i < alpha.length; i++, p += 3) {
    const r = data[p], g = data[p + 1], b = data[p + 2]
    alpha[i] = Math.round(keyAlpha(r, g, b, key) * 255)
    // Spill: the key colour may not exceed the other two channels.
    if (key === 'green' && g > Math.max(r, b)) fg[p + 1] = Math.max(r, b)
    if (key === 'blue' && b > Math.max(r, g)) fg[p + 2] = Math.max(r, g)
  }
  const softAlpha = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } }).blur(Math.max(0.6, w / 1500)).extractChannel(0).raw().toBuffer()
  return placeOnBackground(fg, softAlpha, w, h, backgroundPath)
}

/** The person (RGB + alpha, same size) over the background, which fills the frame ("cover"). */
export async function placeOnBackground(rgb: Buffer, alpha: Buffer, w: number, h: number, backgroundPath: string | Buffer, mirrorPerson = false): Promise<Buffer> {
  let person = sharp(rgb, { raw: { width: w, height: h, channels: 3 } }).joinChannel(alpha, { raw: { width: w, height: h, channels: 1 } })
  if (mirrorPerson) person = person.flop()
  return sharp(backgroundPath)
    .rotate()
    .resize(w, h, { fit: 'cover', position: 'centre' })
    .composite([{ input: await person.png().toBuffer() }])
    .removeAlpha()
    .jpeg({ quality: 95 })
    .toBuffer()
}

/** AI cut-out (no backdrop needed): MODNet finds the people, the background goes behind them. */
export async function aiOntoBackground(photo: Buffer, backgroundPath: string | Buffer, matter: { matte(img: Buffer, shortEdge?: number): Promise<{ alpha: Buffer; width: number; height: number }> }, opts: { shortEdge?: number; mirrorPerson?: boolean } = {}): Promise<Buffer> {
  const { alpha, width, height } = await matter.matte(photo, opts.shortEdge)
  const rgb = await sharp(photo).removeAlpha().raw().toBuffer()
  return placeOnBackground(rgb, alpha, width, height, backgroundPath, opts.mirrorPerson)
}
