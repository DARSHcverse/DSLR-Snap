// Downloads what the app ships but git doesn't hold, verifying checksums:
//   - the AI cut-out model (MODNet, Apache-2.0) → resources/models/
//   - ffmpeg for Windows (LGPL build, uses Windows' own H.264 encoder) → resources/ffmpeg/win32/
// Run once after cloning, and before building the installer:  npm run fetch-models
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MODELS = [
  {
    file: 'modnet.onnx',
    url: 'https://huggingface.co/Xenova/modnet/resolve/main/onnx/model.onnx',
    sha256: '07c308cf0fc7e6e8b2065a12ed7fc07e1de8febb7dc7839d7b7f15dd66584df9'
  }
]

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'resources', 'models')
mkdirSync(dir, { recursive: true })
const sha = (buf) => createHash('sha256').update(buf).digest('hex')

for (const m of MODELS) {
  const path = join(dir, m.file)
  if (existsSync(path) && sha(readFileSync(path)) === m.sha256) {
    console.log(`${m.file}: already here`)
    continue
  }
  console.log(`${m.file}: downloading…`)
  const res = await fetch(m.url)
  if (!res.ok) throw new Error(`${m.file}: download failed (${res.status})`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (sha(buf) !== m.sha256) throw new Error(`${m.file}: checksum mismatch, refusing to use it`)
  writeFileSync(path, buf)
  console.log(`${m.file}: ok (${(buf.length / 1e6).toFixed(1)} MB)`)
}

// ffmpeg: BtbN's LGPL build, pinned. BtbN deletes old autobuilds after a while; if this URL stops
// working, copy the same zip to a GitHub release of this repo and point FFMPEG.url at it.
const FFMPEG = {
  url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2026-10-26-14-25/ffmpeg-n8.1.3-24-g92611900bb-win64-lgpl-shared-8.1.zip',
  sha256: '96afe9bee66012f4cbc336a473f0b595060d73bdc5efe4331d55101500d0a93e'
}
const ffDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'resources', 'ffmpeg', 'win32')
if (existsSync(join(ffDir, 'ffmpeg.exe'))) {
  console.log('ffmpeg (Windows): already here')
} else {
  console.log('ffmpeg (Windows): downloading ~80 MB…')
  const res = await fetch(FFMPEG.url)
  if (!res.ok) throw new Error(`ffmpeg: download failed (${res.status}). See the note in scripts/fetch-models.mjs.`)
  const zip = Buffer.from(await res.arrayBuffer())
  if (sha(zip) !== FFMPEG.sha256) throw new Error('ffmpeg: checksum mismatch, refusing to use it')
  const tmp = mkdtempSync(join(tmpdir(), 'ffmpeg-'))
  writeFileSync(join(tmp, 'ff.zip'), zip)
  execFileSync('tar', ['-xf', join(tmp, 'ff.zip'), '-C', tmp]) // bsdtar reads zip on Windows 10+ and macOS
  const root = readdirSync(tmp).find((d) => d.startsWith('ffmpeg-'))
  mkdirSync(ffDir, { recursive: true })
  for (const f of readdirSync(join(tmp, root, 'bin'))) if (f !== 'ffplay.exe') cpSync(join(tmp, root, 'bin', f), join(ffDir, f))
  cpSync(join(tmp, root, 'LICENSE.txt'), join(ffDir, 'LICENSE.txt'))
  rmSync(tmp, { recursive: true, force: true })
  console.log('ffmpeg (Windows): ok')
}
