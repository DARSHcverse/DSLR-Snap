import { randomBytes } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { accountState, type AccountState, type LicencePayload, pkceChallenge, verifyLicence } from './licence'

export interface AccountStore {
  get(key: string): string | undefined
  set(key: string, value: string | null): void
}

/** Encrypts the refresh token at rest (Electron safeStorage → Windows DPAPI). */
export interface SecretBox {
  encrypt(plain: string): string
  decrypt(stored: string): string
}

export interface AccountDeps {
  store: AccountStore
  secrets: SecretBox
  /** e.g. https://dslrsnap.com, no trailing slash. */
  accountUrl: string
  /** Base64 SPKI DER Ed25519 key; empty when this build has none. */
  publicKey: string
  packaged: boolean
  machineHash: string
  deviceName: string
  openExternal(url: string): Promise<void> | void
  fetch?: typeof fetch
  now?: () => number
  log?: (level: 'info' | 'warn', msg: string) => void
}

const KEY = { licence: 'account.licence', refresh: 'account.refresh', lastSeen: 'account.lastSeen' }
const PENDING_TTL_MS = 15 * 60_000
export const REFRESH_EVERY_MS = 6 * 60 * 60_000

export class AccountError extends Error {
  constructor(public code: string, message: string) {
    super(message)
  }
}

/**
 * Signs the booth in through the website (browser + PKCE), keeps the signed licence fresh, and
 * answers "is this booth licensed?". Contains no Electron imports so it runs in tests.
 */
export class AccountService extends EventEmitter {
  private pending?: { verifier: string; state: string; at: number }
  private timer?: NodeJS.Timeout

  constructor(private deps: AccountDeps) {
    super()
  }

  private get now(): number {
    return (this.deps.now ?? Date.now)()
  }
  private get configured(): boolean {
    return !!this.deps.publicKey && !!this.deps.accountUrl
  }

  private licence(): LicencePayload | null {
    const token = this.deps.store.get(KEY.licence)
    return token && this.configured ? verifyLicence(token, this.deps.publicKey, this.deps.machineHash) : null
  }

  private refreshToken(): string | undefined {
    const stored = this.deps.store.get(KEY.refresh)
    if (!stored) return undefined
    try {
      return this.deps.secrets.decrypt(stored)
    } catch {
      return undefined // e.g. the database was copied from another Windows user or PC
    }
  }

  state(): AccountState {
    const now = this.now
    const lastSeen = Number(this.deps.store.get(KEY.lastSeen)) || 0
    if (now > lastSeen) this.deps.store.set(KEY.lastSeen, String(now))
    return accountState({
      configured: this.configured,
      packaged: this.deps.packaged,
      licence: this.licence(),
      signedIn: !!this.refreshToken(),
      now,
      lastSeen
    })
  }

  /** What the booth sends to the website's /api/app routes; null when signed out. */
  apiCredentials(): { refreshToken: string; machine: string } | null {
    const refreshToken = this.refreshToken()
    return refreshToken && this.configured ? { refreshToken, machine: this.deps.machineHash } : null
  }

  get accountUrl(): string {
    return this.deps.accountUrl
  }

  /** Text stamped on photos while unlicensed; undefined when licensed (or in a developer build). */
  watermark(): string | undefined {
    return this.state().mode === 'trial' ? 'DSLR Snap · trial' : undefined
  }

  /** Opens the website in the default browser; it comes back via dslrsnap://auth or a typed code. */
  async startSignIn(): Promise<void> {
    if (!this.configured) throw new AccountError('not_configured', 'This build of DSLR Snap cannot sign in.')
    const verifier = randomBytes(32).toString('base64url')
    const state = randomBytes(16).toString('base64url')
    this.pending = { verifier, state, at: this.now }
    const q = new URLSearchParams({ challenge: pkceChallenge(verifier), state, name: this.deps.deviceName })
    await this.deps.openExternal(`${this.deps.accountUrl}/app/sign-in?${q}`)
  }

  /** dslrsnap://auth?code=…&state=… from the browser. Ignores links this app didn't start. */
  async handleDeepLink(link: string): Promise<boolean> {
    let url: URL
    try {
      url = new URL(link)
    } catch {
      return false
    }
    if (url.protocol !== 'dslrsnap:' || url.hostname !== 'auth') return false
    const code = url.searchParams.get('code')
    if (!code || !this.pending || url.searchParams.get('state') !== this.pending.state) return false
    await this.redeemCode(code)
    return true
  }

  /** The code from the browser, delivered by deep link or typed in by the operator. */
  async redeemCode(code: string): Promise<AccountState> {
    const p = this.pending
    if (!p || this.now - p.at > PENDING_TTL_MS) throw new AccountError('no_pending', 'Press "Sign in" first, then finish signing in on the website.')
    const res = await this.post('/api/app/token', {
      code: code.trim().toUpperCase(),
      verifier: p.verifier,
      machine: this.deps.machineHash,
      name: this.deps.deviceName
    })
    this.pending = undefined
    this.save(res.refreshToken, res.licence)
    this.deps.log?.('info', 'signed in')
    return this.state()
  }

  /** Fetches a fresh licence. Offline is fine (the stored licence keeps working until it expires). */
  async refresh(): Promise<AccountState> {
    const token = this.refreshToken()
    if (!token || !this.configured) return this.state()
    try {
      const res = await this.post('/api/app/licence', { refreshToken: token, machine: this.deps.machineHash })
      this.deps.store.set(KEY.licence, res.licence)
      this.emit('changed')
    } catch (e) {
      if (e instanceof AccountError && e.code === 'signed_out') {
        // Removed on the website, or signed in on another PC with the same id.
        this.clear()
        this.deps.log?.('warn', 'signed out by the website')
      } else {
        this.deps.log?.('warn', `licence refresh failed: ${e instanceof Error ? e.message : e}`)
      }
    }
    return this.state()
  }

  async signOut(): Promise<AccountState> {
    const token = this.refreshToken()
    if (token) await this.post('/api/app/sign-out', { refreshToken: token }).catch(() => undefined)
    this.clear()
    return this.state()
  }

  start(): void {
    void this.refresh()
    this.timer = setInterval(() => void this.refresh(), REFRESH_EVERY_MS)
  }

  stop(): void {
    clearInterval(this.timer)
  }

  private save(refreshToken: string, licence: string): void {
    if (!verifyLicence(licence, this.deps.publicKey, this.deps.machineHash)) {
      throw new AccountError('bad_licence', 'The website sent a licence this app could not verify. Update DSLR Snap.')
    }
    this.deps.store.set(KEY.refresh, this.deps.secrets.encrypt(refreshToken))
    this.deps.store.set(KEY.licence, licence)
    this.emit('changed')
  }

  private clear(): void {
    this.deps.store.set(KEY.refresh, null)
    this.deps.store.set(KEY.licence, null)
    this.emit('changed')
  }

  private async post(path: string, body: unknown): Promise<{ refreshToken: string; licence: string }> {
    const res = await (this.deps.fetch ?? fetch)(`${this.deps.accountUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000)
    })
    const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string; refreshToken?: string; licence?: string }
    if (!res.ok) throw new AccountError(json.error ?? `http_${res.status}`, json.message ?? `The website returned ${res.status}.`)
    return json as { refreshToken: string; licence: string }
  }
}
