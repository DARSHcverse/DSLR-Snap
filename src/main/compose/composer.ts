import sharp, { type OverlayOptions } from 'sharp'
import { canvasSize, fillTokens, SHEET } from '../../shared/layout'
import type { Look, Template, TextItem } from '../../shared/types'
import { applyLook } from './looks'
import { aiOntoBackground, type KeyColour, keyOntoBackground } from './chromaKey'
import { portraitMatter } from './aiModel'

export interface ComposeInput {
  template: Template
  photoPaths: string[]
  eventName: string
  date?: Date
  /** Stamped across the bottom of the design while the booth is unlicensed (trial). */
  watermark?: string
  /** Green/blue screen: replace the backdrop in each photo with this image. */
  /** 'ai' cuts people out with the on-device model instead of a green/blue key. */
  background?: { path: string; key: KeyColour | 'ai' }
  /** Filter for the photos (not the template artwork). */
  look?: Look
  skinSmoothing?: number
}

export interface ComposeOutput {
  /** The design as guests see it (single strip, or the 4x6 in its own orientation). Used for gallery/QR. */
  composite: Buffer
  /** What goes to the printer: always a portrait 4x6 sheet. 2x6 strips are duplicated side by side. */
  printSheet: Buffer
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!)
}

function textSvg(items: TextItem[], w: number, h: number, vars: { event: string; date: Date }): Buffer {
  const nodes = items
    .map((t) => {
      const family = escapeXml(t.fontFamily ?? 'Helvetica, Arial, sans-serif')
      return `<text x="${t.x}" y="${t.y}" font-size="${t.size}" fill="${escapeXml(t.color)}" font-family="${family}" font-weight="${t.weight ?? 'normal'}" text-anchor="${t.align ?? 'start'}">${escapeXml(fillTokens(t.text, vars))}</text>`
    })
    .join('')
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${nodes}</svg>`)
}

/** A readable band near the bottom: visible on any background, small enough not to ruin the photo. */
function watermarkSvg(text: string, w: number, h: number): Buffer {
  const size = Math.round(w * 0.05)
  const bandH = Math.round(size * 1.9)
  const y = h - Math.round(h * 0.06) - bandH
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
      `<rect x="0" y="${y}" width="${w}" height="${bandH}" fill="#000" fill-opacity="0.45"/>` +
      `<text x="${w / 2}" y="${y + bandH / 2}" dominant-baseline="central" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="bold" font-size="${size}" fill="#fff" fill-opacity="0.9">${escapeXml(text)}</text>` +
      `</svg>`
  )
}

/**
 * Renders photos into a template. Photos are centre-cropped to fill each slot ("cover"),
 * which is what guests expect from a booth print. EXIF rotation is applied first.
 */
export async function compose(input: ComposeInput): Promise<ComposeOutput> {
  const { template, photoPaths } = input
  if (photoPaths.length < template.slots.length) {
    throw new Error(`Template "${template.name}" needs ${template.slots.length} photos, got ${photoPaths.length}.`)
  }
  const size = canvasSize(template.format, template.orientation)
  const vars = { event: input.eventName, date: input.date ?? new Date() }

  const layers: OverlayOptions[] = []
  if (template.backgroundPath) {
    const background = await sharp(template.backgroundPath).resize(size.w, size.h, { fit: 'fill' }).png().toBuffer()
    layers.push({ input: background, left: 0, top: 0 })
  }
  for (let i = 0; i < template.slots.length; i++) {
    const s = template.slots[i]
    const sw = Math.round(s.w)
    const sh = Math.round(s.h)
    let photo: Buffer
    if (input.background) {
      // Swap the backdrop on the whole frame first (as the live view shows it), then crop to the slot
      // like any photo, so the client's logo sits where guests saw it.
      const frame = await sharp(photoPaths[i]).rotate().resize(sw, sh, { fit: 'outside' }).toBuffer()
      const { key, path } = input.background
      const matter = key === 'ai' ? portraitMatter() : undefined
      if (key === 'ai' && !matter) throw new Error('AI backgrounds need the AI model. Reinstall DSLR Snap or switch the event to green screen.')
      const keyed = key === 'ai' ? await aiOntoBackground(frame, path, matter!) : await keyOntoBackground(frame, path, key)
      photo = await sharp(keyed).resize(sw, sh, { fit: 'cover', position: 'centre' }).toBuffer()
    } else {
      photo = await sharp(photoPaths[i]).rotate().resize(sw, sh, { fit: 'cover', position: 'centre' }).toBuffer()
    }
    if (input.look && input.look !== 'colour') photo = await applyLook(photo, input.look, { skinSmoothing: input.skinSmoothing })
    layers.push({ input: photo, left: Math.round(s.x), top: Math.round(s.y) })
  }
  if (template.overlayPath) {
    const overlay = await sharp(template.overlayPath).resize(size.w, size.h, { fit: 'fill' }).png().toBuffer()
    layers.push({ input: overlay, left: 0, top: 0 })
  }
  if (template.logo) {
    const l = template.logo
    const logo = await sharp(l.path).resize(Math.round(l.w), Math.round(l.h), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
    layers.push({ input: logo, left: Math.round(l.x), top: Math.round(l.y) })
  }
  if (template.texts.length) layers.push({ input: textSvg(template.texts, size.w, size.h, vars), left: 0, top: 0 })
  if (input.watermark) layers.push({ input: watermarkSvg(input.watermark, size.w, size.h), left: 0, top: 0 })

  const composite = await sharp({ create: { width: size.w, height: size.h, channels: 3, background: template.background } })
    .composite(layers)
    .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
    .withMetadata({ density: 300 })
    .toBuffer()

  let printSheet: Buffer
  if (template.format === '2x6') {
    printSheet = await sharp({ create: { width: SHEET.w, height: SHEET.h, channels: 3, background: template.background } })
      .composite([
        { input: composite, left: 0, top: 0 },
        { input: composite, left: SHEET.w / 2, top: 0 }
      ])
      .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
      .withMetadata({ density: 300 })
      .toBuffer()
  } else if (template.orientation === 'landscape') {
    // Always hand the driver a portrait sheet so we never depend on driver orientation settings.
    printSheet = await sharp(composite).rotate(90).jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).withMetadata({ density: 300 }).toBuffer()
  } else {
    printSheet = composite
  }

  return { composite, printSheet }
}

export async function previewDataUrl(input: Buffer | string, width = 480): Promise<string> {
  const buf = await sharp(input).rotate().resize({ width, withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer()
  return `data:image/jpeg;base64,${buf.toString('base64')}`
}
