// Copies the pinned dependencies (scripts/deps.mjs) to R2, so builds keep working after upstream
// deletes or changes them. Needs the R2_* values in .env (same as `npm run release`).
//   node scripts/mirror-deps.mjs
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { DEPS, MIRROR } from './deps.mjs'

const root = new URL('..', import.meta.url).pathname
const env = Object.fromEntries(
  (existsSync(join(root, '.env')) ? readFileSync(join(root, '.env'), 'utf8') : '')
    .split('\n')
    .filter((l) => /^R2_[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
)
for (const k of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET']) if (!env[k]) throw new Error(`Missing ${k} in .env`)
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY }
})
const sha = (buf) => createHash('sha256').update(buf).digest('hex')

for (const dep of Object.values(DEPS)) {
  const Key = `deps/${dep.name}`
  const there = await s3.send(new HeadObjectCommand({ Bucket: env.R2_BUCKET, Key })).catch(() => null)
  if (there?.Metadata?.sha256 === dep.sha256) {
    console.log(`${dep.name}: already mirrored`)
    continue
  }
  process.stdout.write(`${dep.name}: downloading from upstream… `)
  const res = await fetch(dep.upstream)
  if (!res.ok) throw new Error(`upstream ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (sha(buf) !== dep.sha256) throw new Error('checksum mismatch: upstream changed, not mirroring it')
  await s3.send(new PutObjectCommand({ Bucket: env.R2_BUCKET, Key, Body: buf, ContentType: 'application/octet-stream', CacheControl: 'public, max-age=31536000, immutable', Metadata: { sha256: dep.sha256 } }))
  console.log(`mirrored (${(buf.length / 1e6).toFixed(1)} MB) → ${MIRROR}/${dep.name}`)
}
