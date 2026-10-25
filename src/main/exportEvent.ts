import { copyFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { safeName } from './BoothService'
import type { BoothDatabase } from './db/database'

/**
 * Copies an event's finished designs (and optionally the original camera files) into
 * `<dest>/<date> <event name>/`, e.g. onto a USB stick for the client. Re-exporting overwrites,
 * so running it again after more sessions just adds the new ones.
 */
export async function exportEventPhotos(
  db: BoothDatabase,
  eventId: string,
  dest: string,
  opts: { originals: boolean }
): Promise<{ folder: string; prints: number; originals: number; missing: number }> {
  const ev = db.getEvent(eventId)
  if (!ev) throw new Error('Unknown event')
  const folder = join(dest, `${ev.date} ${safeName(ev.name)}`)
  const sessions = db.listSessions(eventId, 100_000).filter((s) => s.status === 'complete')
  let prints = 0
  let originals = 0
  let missing = 0

  const copy = async (from: string, to: string) => {
    if (!existsSync(from)) return (missing++, false)
    await copyFile(from, to)
    return true
  }

  for (const s of sessions) {
    // Time first so files sort in the order guests used the booth.
    const stamp = `${s.createdAt.replace(/[:.]/g, '-').slice(0, 19)}_${s.id.slice(0, 8)}`
    if (s.compositePath) {
      await mkdir(join(folder, 'prints'), { recursive: true })
      if (await copy(s.compositePath, join(folder, 'prints', `${stamp}.jpg`))) prints++
    }
    if (opts.originals && s.photoPaths.length) {
      const dir = join(folder, 'originals', stamp)
      await mkdir(dir, { recursive: true })
      for (const p of s.photoPaths) if (await copy(p, join(dir, basename(p)))) originals++
    }
  }
  return { folder, prints, originals, missing }
}
