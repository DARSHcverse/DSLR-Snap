import { createHash, createPublicKey, verify } from 'node:crypto'
import type { AccountState } from '../../shared/types'

export type { AccountState }

/**
 * What dslrsnap.com signs for one computer. The website holds the private key; the app only has the
 * public key, so a licence can be checked offline but can't be forged or edited.
 */
export interface LicencePayload {
  v: 1
  /** Account id. */
  sub: string
  email: string
  /** Hashed machine id this licence was issued to. */
  dev: string
  plan: 'monthly' | 'yearly' | null
  /** The account had a paid subscription when this was issued. */
  active: boolean
  /** Issued at, ms since epoch. */
  iat: number
  /** After this the app must reach the website again (offline grace), ms since epoch. */
  exp: number
}

const b64url = (s: string) => Buffer.from(s, 'base64url')

/** Checks the signature and that the licence belongs to this computer. Returns null for anything invalid. */
export function verifyLicence(token: string, publicKeyB64: string, machineHash: string): LicencePayload | null {
  const [body, sig, extra] = token.split('.')
  if (!body || !sig || extra !== undefined) return null
  try {
    const key = createPublicKey({ key: Buffer.from(publicKeyB64, 'base64'), format: 'der', type: 'spki' })
    if (!verify(null, Buffer.from(body), key, b64url(sig))) return null
    const p = JSON.parse(b64url(body).toString('utf8')) as LicencePayload
    if (p.v !== 1 || p.dev !== machineHash || typeof p.exp !== 'number' || typeof p.iat !== 'number') return null
    return p
  } catch {
    return null
  }
}

/** Allowed clock drift before a backwards clock counts as tampering. */
const CLOCK_SLACK_MS = 60 * 60 * 1000

/**
 * Decides whether the booth is licensed right now. Pure, so every rule is unit-tested.
 * `lastSeen` is the latest time the app has ever observed; a clock wound back past it can't extend a licence.
 */
export function accountState(input: {
  configured: boolean
  packaged: boolean
  licence: LicencePayload | null
  signedIn: boolean
  now: number
  lastSeen: number
}): AccountState {
  const { configured, packaged, licence, signedIn, now, lastSeen } = input
  if (!configured && !packaged) {
    return { mode: 'dev', message: 'Developer build: licensing is off.', signedIn: false, canSignIn: false }
  }
  if (!configured) {
    return { mode: 'trial', message: 'This build cannot sign in. Install DSLR Snap from dslrsnap.com.', signedIn: false, canSignIn: false }
  }
  const base = { signedIn, canSignIn: true, email: licence?.email, plan: licence?.plan }
  if (!signedIn || !licence) {
    return { ...base, signedIn: false, mode: 'trial', message: 'Trial mode: photos carry a watermark. Sign in to remove it.' }
  }
  if (now < lastSeen - CLOCK_SLACK_MS) {
    return { ...base, mode: 'trial', message: "The computer's clock is behind. Fix the date and time, then connect to the internet." }
  }
  if (!licence.active) {
    return { ...base, mode: 'trial', message: 'No active subscription on this account. Choose a plan at dslrsnap.com.' }
  }
  if (now > licence.exp) {
    return { ...base, mode: 'trial', message: 'Connect to the internet once to confirm your subscription.' }
  }
  return { ...base, mode: 'licensed', message: 'Licensed', offlineUntil: licence.exp }
}

/** Machine ids are hashed with an app-specific salt so the raw Windows id never leaves the computer. */
export function hashMachineId(raw: string): string {
  return createHash('sha256').update(`dslrsnap:${raw.trim().toLowerCase()}`).digest('hex')
}

/** PKCE (RFC 7636) S256 challenge for a verifier. */
export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}
