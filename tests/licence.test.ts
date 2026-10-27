import { generateKeyPairSync, sign } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { accountState, hashMachineId, type LicencePayload, pkceChallenge, verifyLicence } from '../src/main/licence/licence'

const { publicKey, privateKey } = generateKeyPairSync('ed25519')
const PUB = publicKey.export({ format: 'der', type: 'spki' }).toString('base64')
const MACHINE = hashMachineId('4c4c4544-0042-3510-8051-b4c04f4d3732')
const NOW = Date.UTC(2026, 9, 27)
const DAY = 86_400_000

/** Same format the website issues: base64url(json).base64url(ed25519 signature). */
function issue(p: Partial<LicencePayload> = {}, key = privateKey): string {
  const payload: LicencePayload = { v: 1, sub: 'u1', email: 'op@example.com', dev: MACHINE, plan: 'yearly', active: true, iat: NOW, exp: NOW + 14 * DAY, ...p }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${sign(null, Buffer.from(body), key).toString('base64url')}`
}

describe('verifyLicence', () => {
  it('accepts a licence signed by the website for this computer', () => {
    expect(verifyLicence(issue(), PUB, MACHINE)?.email).toBe('op@example.com')
  })

  it('rejects a licence copied from another computer', () => {
    expect(verifyLicence(issue({ dev: hashMachineId('other-pc') }), PUB, MACHINE)).toBeNull()
  })

  it('rejects an edited licence (e.g. active flipped to true)', () => {
    const [body, sig] = issue({ active: false }).split('.')
    const p = JSON.parse(Buffer.from(body, 'base64url').toString())
    const forged = Buffer.from(JSON.stringify({ ...p, active: true })).toString('base64url')
    expect(verifyLicence(`${forged}.${sig}`, PUB, MACHINE)).toBeNull()
  })

  it('rejects a licence signed with someone else’s key', () => {
    const other = generateKeyPairSync('ed25519').privateKey
    expect(verifyLicence(issue({}, other), PUB, MACHINE)).toBeNull()
  })

  it('rejects garbage without throwing', () => {
    for (const t of ['', 'abc', 'a.b', 'a.b.c', '.']) expect(verifyLicence(t, PUB, MACHINE)).toBeNull()
  })
})

describe('accountState', () => {
  const licence = verifyLicence(issue(), PUB, MACHINE)
  const base = { configured: true, packaged: true, licence, signedIn: true, now: NOW, lastSeen: NOW }

  it('is licensed with an active, unexpired licence', () => {
    const s = accountState(base)
    expect(s.mode).toBe('licensed')
    expect(s.offlineUntil).toBe(NOW + 14 * DAY)
  })

  it('keeps working offline within the grace period, then falls back to trial', () => {
    expect(accountState({ ...base, now: NOW + 13 * DAY, lastSeen: NOW + 13 * DAY }).mode).toBe('licensed')
    expect(accountState({ ...base, now: NOW + 15 * DAY, lastSeen: NOW + 15 * DAY }).mode).toBe('trial')
  })

  it('does not let a wound-back clock extend the licence', () => {
    const s = accountState({ ...base, now: NOW, lastSeen: NOW + 20 * DAY })
    expect(s.mode).toBe('trial')
    expect(s.message).toMatch(/clock/)
  })

  it('is trial when signed in without a subscription', () => {
    expect(accountState({ ...base, licence: { ...licence!, active: false } }).mode).toBe('trial')
  })

  it('is trial when signed out', () => {
    expect(accountState({ ...base, signedIn: false, licence: null })).toMatchObject({ mode: 'trial', canSignIn: true })
  })

  it('turns licensing off only for unpackaged builds without a key (development)', () => {
    expect(accountState({ ...base, configured: false, packaged: false }).mode).toBe('dev')
    expect(accountState({ ...base, configured: false, packaged: true }).mode).toBe('trial')
  })
})

describe('helpers', () => {
  it('hashes machine ids stably and case-insensitively, never returning the raw id', () => {
    expect(hashMachineId(' ABC ')).toBe(hashMachineId('abc'))
    expect(hashMachineId('abc')).not.toContain('abc')
  })

  it('computes the RFC 7636 S256 challenge', () => {
    // Test vector from RFC 7636 appendix B.
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })
})
