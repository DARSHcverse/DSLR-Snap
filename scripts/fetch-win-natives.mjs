// The Windows installer needs sharp's win32-x64 binaries. npm only installs the current platform's,
// so when building on a Mac this adds @img/sharp-win32-x64 (same version as sharp) to node_modules.
// On Windows it's already there and this does nothing. (better-sqlite3 and onnxruntime-node ship
// every platform's binaries in their own packages.)
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const target = join(root, 'node_modules', '@img', 'sharp-win32-x64')
const version = JSON.parse(readFileSync(join(root, 'node_modules', 'sharp', 'package.json'), 'utf8')).version
const have = existsSync(join(target, 'package.json')) && JSON.parse(readFileSync(join(target, 'package.json'), 'utf8')).version
if (have === version) {
  console.log(`@img/sharp-win32-x64 ${version} present`)
} else {
  const tmp = mkdtempSync(join(tmpdir(), 'sharp-win-'))
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const file = execFileSync(npm, ['pack', `@img/sharp-win32-x64@${version}`, '--silent'], { cwd: tmp, encoding: 'utf8', shell: process.platform === 'win32' }).trim().split('\n').pop()
  execFileSync('tar', ['xzf', file], { cwd: tmp })
  rmSync(target, { recursive: true, force: true })
  renameSync(join(tmp, 'package'), target)
  rmSync(tmp, { recursive: true, force: true })
  console.log(`Added @img/sharp-win32-x64 ${version}`)
}
