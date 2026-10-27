import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { keyAlpha, keyOntoBackground } from '../src/main/compose/chromaKey'

const W = 300
const H = 200
const dir = mkdtempSync(join(tmpdir(), 'key-'))

/** A person-ish block (skin + dark clothes) in front of a green or blue backdrop. */
async function shot(backdrop: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="${backdrop}"/>
    <rect x="110" y="40" width="80" height="60" fill="#efc7a4"/><rect x="100" y="100" width="100" height="100" fill="#3b3f58"/></svg>`
  return sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toBuffer()
}

async function background() {
  const p = join(dir, 'brand.jpg')
  await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#c0102e' } }).jpeg().toFile(p) // client's red brand wall
  return p
}

async function pixel(img: Buffer, x: number, y: number) {
  const { data } = await sharp(img).extract({ left: x, top: y, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true })
  return [data[0], data[1], data[2]]
}

describe('green screen', () => {
  it('replaces the green backdrop with the client background and keeps the person', async () => {
    const out = await keyOntoBackground(await shot('#2fae4f'), await background(), 'green')
    expect((await sharp(out).metadata()).width).toBe(W)
    const [r, g] = await pixel(out, 20, 20) // backdrop area → brand red
    expect(r).toBeGreaterThan(150)
    expect(g).toBeLessThan(60)
    const skin = await pixel(out, 150, 70)
    expect(skin[0]).toBeGreaterThan(200) // skin survives
    expect(Math.abs(skin[1] - 199)).toBeLessThan(20)
    const clothes = await pixel(out, 150, 160)
    expect(clothes[2]).toBeGreaterThan(70) // dark navy, not swapped out
  })

  it('works with a blue backdrop', async () => {
    const out = await keyOntoBackground(await shot('#2456c8'), await background(), 'blue')
    expect((await pixel(out, 20, 20))[0]).toBeGreaterThan(150)
  })

  it('treats skin, white and dark clothes as the person, saturated green as backdrop', () => {
    expect(keyAlpha(239, 199, 164, 'green')).toBe(1)
    expect(keyAlpha(255, 255, 255, 'green')).toBe(1)
    expect(keyAlpha(59, 63, 88, 'green')).toBe(1)
    expect(keyAlpha(47, 174, 79, 'green')).toBe(0)
    const edge = keyAlpha(90, 140, 90, 'green') // half-mixed hair edge
    expect(edge).toBeGreaterThan(0)
    expect(edge).toBeLessThan(1)
  })
})
