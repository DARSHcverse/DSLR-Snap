import { useEffect, useState } from 'react'
import type { AccountState } from '@shared/types'

/** Live licence state for the admin header and the Account screen. */
export function useAccount(): AccountState | null {
  const [state, setState] = useState<AccountState | null>(null)
  useEffect(() => {
    window.booth.accountState().then(setState)
    return window.booth.onAccount(setState)
  }, [])
  return state
}

const PLAN = { monthly: 'Monthly plan', yearly: 'Yearly plan' } as const

export default function AccountTab() {
  const state = useAccount()
  const [waiting, setWaiting] = useState(false)
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => window.booth.onAccountError(setMsg), [])
  useEffect(() => {
    if (state?.signedIn) setWaiting(false)
  }, [state?.signedIn])
  if (!state) return <div className="spinner" />

  const run = async (fn: () => Promise<unknown>) => {
    setMsg(null)
    try {
      await fn()
    } catch (e) {
      // Electron prefixes IPC errors with the channel name; operators only need the reason.
      setMsg(String(e instanceof Error ? e.message : e).replace(/^Error invoking remote method '[^']+': (Account)?Error: /, ''))
    }
  }
  const signIn = () =>
    run(async () => {
      await window.booth.accountSignIn()
      setWaiting(true)
    })

  return (
    <section className="devices">
      <div className="card">
        <h3>Licence</h3>
        <p>
          <span className={`pill ${state.mode === 'licensed' ? 'ok' : state.mode === 'trial' ? 'busy' : ''}`}>
            {state.mode === 'licensed' ? 'Licensed' : state.mode === 'trial' ? 'Trial' : 'Developer build'}
          </span>
        </p>
        <p className="muted">{state.mode === 'licensed' ? 'Photos and prints have no watermark.' : state.message}</p>
        {state.signedIn && (
          <p className="muted small">
            Signed in as {state.email}
            {state.plan ? ` · ${PLAN[state.plan]}` : ''}
            {state.offlineUntil ? ` · works offline until ${new Date(state.offlineUntil).toLocaleDateString()}` : ''}
          </p>
        )}

        {state.canSignIn && !state.signedIn && (
          <>
            <div className="row">
              <button className="btn primary" onClick={signIn}>Sign in</button>
              <button className="btn ghost" onClick={() => window.booth.openAccountWebsite('pricing')}>See plans</button>
            </div>
            {waiting && (
              <div className="field">
                <span className="field-label">
                  Finish signing in in your browser. It returns here by itself. If it doesn't, type the code the website shows:
                </span>
                <div className="row">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="ABCD2345"
                    maxLength={9}
                    style={{ width: 160, letterSpacing: '0.2em' }}
                  />
                  <button className="btn" disabled={code.trim().length < 8} onClick={() => run(() => window.booth.accountRedeemCode(code))}>
                    Use code
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {state.signedIn && (
          <div className="row">
            <button className="btn" onClick={() => run(() => window.booth.accountRefresh())}>Check again</button>
            <button className="btn" onClick={() => window.booth.openAccountWebsite('account')}>Manage plan & computers</button>
            <button className="btn ghost danger" onClick={() => confirm('Sign this computer out? Photos will carry the trial watermark until you sign in again.') && run(() => window.booth.accountSignOut())}>
              Sign out
            </button>
          </div>
        )}
        {msg && <p className="muted" style={{ color: 'var(--bad)' }}>{msg}</p>}
      </div>
      <div className="card">
        <h3>How licensing works</h3>
        <p className="muted small">
          One plan covers 2 booth computers. The booth checks your plan whenever it's online and keeps working offline for 14 days, so venue Wi-Fi never stops an event.
          Without a plan everything still works, but photos and prints carry a small "DSLR Snap · trial" band.
        </p>
      </div>
    </section>
  )
}
