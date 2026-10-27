import { generateKeyPairSync, sign } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { AccountService, type AccountStore } from '../src/main/licence/AccountService'
import { hashMachineId, pkceChallenge } from '../src/main/licence/licence'

const { publicKey, privateKey } = generateKeyPairSync('ed25519')
const PUB = publicKey.export({ format: 'der', type: 'spki' }).toString('base64')
const MACHINE = hashMachineId('pc-1')
const NOW = Date.UTC(2026, 9, 27)

function licence(active = true): string {
  const body = Buffer.from(JSON.stringify({ v: 1, sub: 'u1', email: 'op@example.com', dev: MACHINE, plan: 'yearly', active, iat: NOW, exp: NOW + 14 * 86_400_000 })).toString('base64url')
  return `${body}.${sign(null, Buffer.from(body), privateKey).toString('base64url')}`
}

/** A stand-in for dslrsnap.com's /api/app routes with the same rules (one-time code bound to the PKCE challenge). */
function fakeSite() {
  const site = { challenge: '', code: 'ABCD2345', online: true, revoked: false, active: true, opened: '' }
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  const fetchFn = (async (url: string, init: RequestInit) => {
    if (!site.online) throw new TypeError('fetch failed')
    const body = JSON.parse(String(init.body))
    if (url.endsWith('/api/app/token')) {
      if (body.code !== site.code || pkceChallenge(body.verifier) !== site.challenge) return json(400, { error: 'invalid_code', message: 'That code has expired.' })
      return json(200, { refreshToken: 'rt-secret', licence: licence(site.active) })
    }
    if (url.endsWith('/api/app/licence')) {
      if (site.revoked) return json(401, { error: 'signed_out', message: 'Signed out' })
      return json(200, { licence: licence(site.active) })
    }
    return json(200, {})
  }) as unknown as typeof fetch
  return { site, fetchFn }
}

function setup() {
  const data = new Map<string, string>()
  const store: AccountStore = { get: (k) => data.get(k), set: (k, v) => (v === null ? data.delete(k) : data.set(k, v)) }
  const { site, fetchFn } = fakeSite()
  const svc = new AccountService({
    store,
    secrets: { encrypt: (s) => `enc:${Buffer.from(s).toString('base64')}`, decrypt: (s) => Buffer.from(s.slice(4), 'base64').toString() },
    accountUrl: 'https://dslrsnap.test',
    publicKey: PUB,
    packaged: true,
    machineHash: MACHINE,
    deviceName: 'Booth PC',
    openExternal: (u) => {
      site.opened = u
      site.challenge = new URL(u).searchParams.get('challenge')!
    },
    fetch: fetchFn,
    now: () => NOW
  })
  const stateParam = () => new URL(site.opened).searchParams.get('state')!
  return { svc, site, data, stateParam }
}

describe('AccountService', () => {
  it('starts in trial mode with a watermark', () => {
    const { svc } = setup()
    expect(svc.state()).toMatchObject({ mode: 'trial', signedIn: false })
    expect(svc.watermark()).toBe('DSLR Snap · trial')
  })

  it('signs in through the browser link and removes the watermark', async () => {
    const { svc, site, stateParam } = setup()
    await svc.startSignIn()
    expect(site.opened).toMatch(/^https:\/\/dslrsnap\.test\/app\/sign-in\?challenge=/)
    expect(await svc.handleDeepLink(`dslrsnap://auth?code=${site.code}&state=${stateParam()}`)).toBe(true)
    expect(svc.state()).toMatchObject({ mode: 'licensed', email: 'op@example.com' })
    expect(svc.watermark()).toBeUndefined()
  })

  it('ignores a link it did not start (wrong state)', async () => {
    const { svc, site } = setup()
    await svc.startSignIn()
    expect(await svc.handleDeepLink(`dslrsnap://auth?code=${site.code}&state=attacker`)).toBe(false)
    expect(svc.state().mode).toBe('trial')
  })

  it('accepts the code typed in by hand (lower case, spaces)', async () => {
    const { svc, site } = setup()
    await svc.startSignIn()
    await svc.redeemCode(` ${site.code.toLowerCase()} `)
    expect(svc.state().mode).toBe('licensed')
  })

  it('shows the website’s reason when a code is refused', async () => {
    const { svc } = setup()
    await svc.startSignIn()
    await expect(svc.redeemCode('WRONG123')).rejects.toThrow('That code has expired.')
  })

  it('stores the refresh token encrypted, never in plain text', async () => {
    const { svc, site, data, stateParam } = setup()
    await svc.startSignIn()
    await svc.handleDeepLink(`dslrsnap://auth?code=${site.code}&state=${stateParam()}`)
    expect([...data.values()].join()).not.toContain('rt-secret')
  })

  it('keeps the licence when offline, and drops it when the website signs this PC out', async () => {
    const { svc, site, stateParam } = setup()
    await svc.startSignIn()
    await svc.handleDeepLink(`dslrsnap://auth?code=${site.code}&state=${stateParam()}`)
    site.online = false
    expect((await svc.refresh()).mode).toBe('licensed')
    site.online = true
    site.revoked = true
    expect(await svc.refresh()).toMatchObject({ mode: 'trial', signedIn: false })
  })

  it('goes to trial when the subscription ends', async () => {
    const { svc, site, stateParam } = setup()
    await svc.startSignIn()
    await svc.handleDeepLink(`dslrsnap://auth?code=${site.code}&state=${stateParam()}`)
    site.active = false
    expect((await svc.refresh()).mode).toBe('trial')
  })
})
