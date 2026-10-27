import { execFile } from 'node:child_process'
import { basename, dirname, join } from 'node:path'

/**
 * Where an event's files go, laid out for the operator rather than the app:
 *
 *   <photos folder>/<Event name> <date>/
 *     Photos/      camera originals   "20.14.05 1.jpg"
 *     Prints/      finished designs   "20.14.05.jpg" (+ "20.14.05 colour.jpg")
 *     GIFs/        "20.14.05.gif"
 *     Boomerangs/  "20.14.05.gif" and "20.14.05.mp4"
 *     .booth/      print sheets and thumbnails the app needs (hidden on Windows)
 *
 * Files are named by the time the guest used the booth, so they sort in order.
 */
export const FOLDERS = { photos: 'Photos', prints: 'Prints', gifs: 'GIFs', boomerangs: 'Boomerangs', internal: '.booth' } as const

/** Folder-safe text for Windows and macOS: no \ / : * ? " < > | and no trailing dots or spaces. */
export function safeFolderName(s: string): string {
  return s.replace(/[\\/:*?"<>|\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 80) || 'Event'
}

/** "Priya & Tom 2026-10-31", or "… (2)" when another event already uses that folder. */
export function eventFolderName(ev: { name: string; date: string }, taken: (name: string) => boolean): string {
  const base = `${safeFolderName(ev.name)} ${ev.date}`
  if (!taken(base)) return base
  for (let n = 2; ; n++) if (!taken(`${base} (${n})`)) return `${base} (${n})`
}

/** Local time of the session, "20.14.05" (colons aren't allowed in Windows file names). */
export function sessionStamp(createdAt: string): string {
  const d = new Date(createdAt)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}.${p(d.getMinutes())}.${p(d.getSeconds())}`
}

export interface SessionLayout {
  photosDir: string
  /** The n-th camera shot of the session (1-based; retakes get the next number). */
  original: (n: number) => string
  final: string
  colour: string
  gif: string
  boomerang: string
  /** MP4 of the boomerang, for Instagram/WhatsApp (they don't take GIFs). */
  boomerangVideo: string
  printSheet: string
  thumb: string
}

export function sessionLayout(eventFolder: string, stamp: string): SessionLayout {
  return {
    photosDir: join(eventFolder, FOLDERS.photos),
    original: (n) => join(eventFolder, FOLDERS.photos, `${stamp} ${n}.jpg`),
    final: join(eventFolder, FOLDERS.prints, `${stamp}.jpg`),
    colour: join(eventFolder, FOLDERS.prints, `${stamp} colour.jpg`),
    gif: join(eventFolder, FOLDERS.gifs, `${stamp}.gif`),
    boomerang: join(eventFolder, FOLDERS.boomerangs, `${stamp}.gif`),
    boomerangVideo: join(eventFolder, FOLDERS.boomerangs, `${stamp}.mp4`),
    printSheet: join(eventFolder, FOLDERS.internal, `${stamp} print-sheet.jpg`),
    thumb: join(eventFolder, FOLDERS.internal, `${stamp} thumb.jpg`)
  }
}

/**
 * A session's other files, from its final design. Sessions saved before event folders existed
 * kept everything next to "final.jpg" in a per-session folder; those keep working.
 */
export function layoutFromFinal(finalPath: string): Omit<SessionLayout, 'photosDir' | 'original'> {
  if (basename(finalPath) === 'final.jpg') {
    const dir = dirname(finalPath)
    return {
      final: finalPath,
      colour: join(dir, 'final-colour.jpg'),
      gif: join(dir, 'animation.gif'),
      boomerang: join(dir, 'boomerang.gif'),
      boomerangVideo: join(dir, 'boomerang.mp4'),
      printSheet: join(dir, 'print-sheet.jpg'),
      thumb: join(dir, 'thumb.jpg')
    }
  }
  const { original: _o, photosDir: _p, ...rest } = sessionLayout(dirname(dirname(finalPath)), basename(finalPath, '.jpg'))
  return rest
}

/** Hides the app's own folder (.booth) in Windows Explorer; macOS already hides dot-folders. */
export function hideOnWindows(dir: string): void {
  if (process.platform === 'win32') execFile('attrib', ['+h', dir], { windowsHide: true }, () => undefined)
}
