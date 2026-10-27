import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HostedGallery } from '../src/main/cloud/HostedGallery'

const SESSION = '6f1c2a4e-8a0b-4c7e-9d3f-1b2c3d4e5f60'

function setup(opts: { colour?: boolean; gif?: boolean; refuse?: boolean } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'hosted-'))
  const final = join(dir, 'final.jpg')
  writeFileSync(final, 'jpeg-bytes')
  if (opts.colour) writeFileSync(join(dir, 'final-colour.jpg'), 'colour-bytes')
  if (opts.gif) writeFileSync(join(dir, 'animation.gif'), 'gif-bytes')

  const calls: { url: string; method: string; body: unknown }[] = []
  const fetchFn = (async (url: string, init: RequestInit) => {
    const body = init.method === 'PUT' ? Buffer.from(init.body as Uint8Array).toString() : JSON.parse(String(init.body))
    calls.push({ url, method: String(init.method), body })
    if (opts.refuse && url.endsWith('/api/app/uploads')) {
      return new Response(JSON.stringify({ error: 'subscription_required', message: 'QR downloads need an active plan.' }), { status: 402 })
    }
    if (url.endsWith('/api/app/uploads')) {
      const files = (body as { files: { kind: string }[] }).files
      return Response.json({ uploads: files.map((f) => ({ kind: f.kind, url: `https://storage.test/${f.kind}?token=t` })), pageUrl: `https://dslrsnap.test/s/${SESSION}` })
    }
    return Response.json({ ok: true })
  }) as unknown as typeof fetch

  let signedIn = true
  const gallery = new HostedGallery({
    accountUrl: 'https://dslrsnap.test',
    credentials: () => (signedIn ? { refreshToken: 'rt', machine: 'm'.repeat(64) } : null),
    allowed: () => true,
    event: () => ({ name: 'Priya & Tom', date: '2026-10-31' }),
    fetch: fetchFn
  })
  return { gallery, calls, final, signOut: () => (signedIn = false) }
}

describe('HostedGallery', () => {
  it('knows the guest page before uploading, so the QR shows instantly', () => {
    expect(setup().gallery.sessionUrl(SESSION)).toBe(`https://dslrsnap.test/s/${SESSION}`)
  })

  it('asks the website for upload links, uploads every file of the session, then marks it ready', async () => {
    const { gallery, calls, final } = setup({ colour: true, gif: true })
    expect(await gallery.upload(SESSION, 'ev1', final)).toBe(`https://dslrsnap.test/s/${SESSION}`)
    const [ask, ...rest] = calls
    expect(ask.body).toMatchObject({
      refreshToken: 'rt',
      sessionId: SESSION,
      event: { id: 'ev1', name: 'Priya & Tom', date: '2026-10-31' },
      files: [
        { kind: 'photo', contentType: 'image/jpeg', bytes: 10 },
        { kind: 'colour', contentType: 'image/jpeg', bytes: 12 },
        { kind: 'gif', contentType: 'image/gif', bytes: 9 }
      ]
    })
    expect(rest.filter((c) => c.method === 'PUT').map((c) => [c.url, c.body])).toEqual([
      ['https://storage.test/photo?token=t', 'jpeg-bytes'],
      ['https://storage.test/colour?token=t', 'colour-bytes'],
      ['https://storage.test/gif?token=t', 'gif-bytes']
    ])
    expect(calls.at(-1)?.url).toBe('https://dslrsnap.test/api/app/uploads/complete')
  })

  it('only sends the files that exist', async () => {
    const { gallery, calls, final } = setup()
    await gallery.upload(SESSION, 'ev1', final)
    expect((calls[0].body as { files: unknown[] }).files).toHaveLength(1)
  })

  it("passes on the website's reason when it refuses (e.g. no active plan), so the queue retries later", async () => {
    const { gallery, final } = setup({ refuse: true })
    await expect(gallery.upload(SESSION, 'ev1', final)).rejects.toThrow('QR downloads need an active plan.')
  })

  it('is off when signed out', () => {
    const { gallery, signOut } = setup()
    expect(gallery.enabled).toBe(true)
    signOut()
    expect(gallery.enabled).toBe(false)
  })
})
