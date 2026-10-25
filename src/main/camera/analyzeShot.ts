import sharp from 'sharp'
import type { TestShot } from '../../shared/types'

/**
 * Brightness check for a test shot. Works on a downscaled greyscale copy, so it is fast even
 * for 24 MP originals. The histogram covers the whole frame; the verdict only looks at the
 * centre, where the guests stand, because booth backdrops are often white and blown out on purpose.
 */
export async function analyzeShot(path: string): Promise<Pick<TestShot, 'histogram' | 'brightness' | 'verdict'>> {
  const { data, info } = await sharp(path).rotate().resize(320, 320, { fit: 'inside' }).greyscale().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info
  const bins = new Array<number>(64).fill(0)
  for (const v of data) bins[v >> 2]++

  // Centre half of the width, middle 60% of the height.
  const x0 = Math.floor(w * 0.25)
  const x1 = Math.ceil(w * 0.75)
  const y0 = Math.floor(h * 0.2)
  const y1 = Math.ceil(h * 0.8)
  let sum = 0
  let clipped = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const v = data[y * w + x]
      sum += v
      if (v >= 250) clipped++
    }
  }
  const n = (x1 - x0) * (y1 - y0)
  const brightness = sum / n
  // Faces blown to pure white are the most common flash mistake; check that before "too dark".
  const verdict = clipped / n > 0.15 || brightness > 200 ? 'bright' : brightness < 70 ? 'dark' : 'good'
  return { histogram: bins.map((b) => b / data.length), brightness, verdict }
}
