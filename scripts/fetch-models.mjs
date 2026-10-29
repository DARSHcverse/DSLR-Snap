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
import { DEPS, sources } from './deps.mjs'

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'resources', 'models')
mkdirSync(dir, { recursive: true })
const sha = (buf) => createHash('sha256').update(buf).digest('hex')

/** Our mirror first, then upstream; only a file with the pinned checksum is accepted. */
async function download(dep) {
  for (const url of sources(dep)) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      if (sha(buf) !== dep.sha256) throw new Error('checksum mismatch')
      return buf
    } catch (e) {
      console.warn(`  ${new URL(url).host}: ${e.message}, trying the next source`)
    }
  }
  throw new Error(`${dep.name}: no source had the expected file`)
}

const modelPath = join(dir, 'modnet.onnx')
if (existsSync(modelPath) && sha(readFileSync(modelPath)) === DEPS.modnet.sha256) {
  console.log('modnet.onnx: already here')
} else {
  console.log('modnet.onnx: downloading…')
  const buf = await download(DEPS.modnet)
  writeFileSync(modelPath, buf)
  console.log(`modnet.onnx: ok (${(buf.length / 1e6).toFixed(1)} MB)`)
}
const ffDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'resources', 'ffmpeg', 'win32')
if (existsSync(join(ffDir, 'ffmpeg.exe'))) {
  console.log('ffmpeg (Windows): already here')
} else {
  console.log('ffmpeg (Windows): downloading ~80 MB…')
  const zip = await download(DEPS.ffmpeg)
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
