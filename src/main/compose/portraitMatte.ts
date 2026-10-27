import { existsSync } from 'node:fs'
import sharp from 'sharp'

/**
 * AI cut-out of people with MODNet (Apache-2.0, ~25 MB, made for portraits). Runs on the laptop
 * through ONNX Runtime: no internet, no per-photo cost. Fast enough for the live view at low size.
 */
const SHORT_EDGE = 512
const MULTIPLE = 32

/** Model input size: short edge ~512, both sides multiples of 32, aspect kept. */
export function inputSize(w: number, h: number, shortEdge = SHORT_EDGE): { w: number; h: number } {
  const scale = shortEdge / Math.min(w, h)
  const round = (v: number) => Math.max(MULTIPLE, Math.round((v * scale) / MULTIPLE) * MULTIPLE)
  return { w: round(w), h: round(h) }
}

/** RGB bytes → float32 CHW scaled to [-1, 1] (mean 0.5, std 0.5), as MODNet was trained. */
export function toTensorData(rgb: Uint8Array, w: number, h: number): Float32Array {
  const plane = w * h
  const out = new Float32Array(3 * plane)
  for (let i = 0; i < plane; i++) {
    out[i] = rgb[i * 3] / 127.5 - 1
    out[plane + i] = rgb[i * 3 + 1] / 127.5 - 1
    out[2 * plane + i] = rgb[i * 3 + 2] / 127.5 - 1
  }
  return out
}

type Session = { run(feeds: Record<string, unknown>): Promise<Record<string, { data: Float32Array }>> }

export class PortraitMatter {
  private session?: Promise<{ session: Session; Tensor: new (type: 'float32', data: Float32Array, dims: number[]) => unknown }>

  constructor(readonly modelPath: string) {}

  get available(): boolean {
    return existsSync(this.modelPath)
  }

  private load() {
    this.session ??= (async () => {
      const ort = await import('onnxruntime-node')
      const session = (await ort.InferenceSession.create(this.modelPath)) as unknown as Session
      return { session, Tensor: ort.Tensor as never }
    })()
    return this.session
  }

  /** One alpha byte per pixel at the image's own size (255 = person). `shortEdge` trades detail for speed. */
  async matte(image: Buffer, shortEdge = SHORT_EDGE): Promise<{ alpha: Buffer; width: number; height: number }> {
    const meta = await sharp(image).metadata()
    const width = meta.width!
    const height = meta.height!
    const size = inputSize(width, height, shortEdge)
    const rgb = await sharp(image).removeAlpha().resize(size.w, size.h, { fit: 'fill' }).raw().toBuffer()
    const { session, Tensor } = await this.load()
    const out = await session.run({ input: new Tensor('float32', toTensorData(rgb, size.w, size.h), [1, 3, size.h, size.w]) })
    const matte = Object.values(out)[0].data
    const small = Buffer.alloc(size.w * size.h)
    for (let i = 0; i < small.length; i++) small[i] = Math.round(Math.min(1, Math.max(0, matte[i])) * 255)
    const alpha = await sharp(small, { raw: { width: size.w, height: size.h, channels: 1 } }).resize(width, height, { fit: 'fill' }).extractChannel(0).raw().toBuffer()
    return { alpha, width, height }
  }
}
