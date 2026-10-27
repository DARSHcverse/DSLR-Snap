import { rm } from 'node:fs/promises'
import { MockCamera } from '../camera/MockCamera'

const SAMPLE_COUNT = 4

/**
 * Placeholder photos so templates can be previewed and test-printed without a camera.
 * The set is made once, by one camera, and never rewritten: previews run in parallel and read
 * these files while composing, so writing them per call let one preview overwrite a file another
 * was still reading (corrupt JPEGs and libvips SIGBUS crashes).
 */
export function createSampleShots(dir: string, backdrop: 'none' | 'green' | 'blue' = 'none'): (n: number) => Promise<string[]> {
  let made: Promise<string[]> | undefined

  const make = async (): Promise<string[]> => {
    await rm(dir, { recursive: true, force: true })
    const cam = new MockCamera({ w: 900, h: 600 })
    cam.backdrop = backdrop
    await cam.connect()
    const shots: string[] = []
    for (let i = 0; i < SAMPLE_COUNT; i++) shots.push(await cam.capture(dir))
    return shots
  }

  return async (n) => {
    made ??= make().catch((e) => {
      made = undefined // let the next preview try again
      throw e
    })
    const shots = await made
    return Array.from({ length: n }, (_, i) => shots[i % shots.length])
  }
}
