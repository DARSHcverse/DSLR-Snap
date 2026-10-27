// Downloads the AI cut-out model (MODNet, Apache-2.0) into resources/models/, verifying its checksum.
// Run once after cloning, and before building the installer:  npm run fetch-models
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
