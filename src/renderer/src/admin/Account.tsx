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
            {state.offlineUntil ? ` · works offline until ${new Date(state.offlineUntil).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
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
          <>
            <div className="row">
              <button className="btn" onClick={() => run(() => window.booth.accountRefresh())}>Check again</button>
              <button className="btn" onClick={() => window.booth.openAccountWebsite('account')}>Manage plan & computers</button>
            </div>
            {/* Rarely needed, so it sits apart from the everyday buttons instead of wrapping onto its own row. */}
            <button className="btn ghost danger small sign-out" onClick={() => confirm('Sign this computer out? Photos will carry the trial watermark until you sign in again.') && run(() => window.booth.accountSignOut())}>
              Sign this computer out
            </button>
          </>
        )}
        {msg && <p className="muted" style={{ color: 'var(--bad)' }}>{msg}</p>}
      </div>
      <SetupCard signedIn={!!state.signedIn} />
      <div className="card">
        <h3>Need help?</h3>
        <p className="muted small">Chat with the DSLR Snap team. We reply by email too, so you don't need to keep the page open.</p>
        <div className="row">
          <button className="btn" onClick={() => window.booth.openAccountWebsite('support')}>Help & chat</button>
        </div>
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

type SetupInfo = Awaited<ReturnType<typeof window.booth.setupInfo>>
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

/**
 * Running two booths: save this computer's templates and booth preferences to the account, then
 * copy them onto the other computer. Camera and printer choices stay with each computer.
 */
function SetupCard({ signedIn }: { signedIn: boolean }) {
  const [info, setInfo] = useState<SetupInfo | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [includePin, setIncludePin] = useState(false)
  const [what, setWhat] = useState({ templates: true, prefs: true, pin: false })

  useEffect(() => {
    if (signedIn) window.booth.setupInfo().then(setInfo).catch(() => setInfo(null))
  }, [signedIn])

  const run = async (fn: () => Promise<string>) => {
    setBusy(true)
    setMsg(null)
    try {
      setMsg(await fn())
    } catch (e) {
      setMsg(String(e instanceof Error ? e.message : e).replace(/^Error invoking remote method '[^']+': (Account)?Error: /, ''))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h3>Use this setup on another computer</h3>
      <p className="muted small">Running more than one booth? Save your templates, booth lock and pedal key to your account, then copy them onto the other computer. Camera, printer and webcam choices stay with each computer; your saved camera settings already follow you.</p>
      {!signedIn ? (
        <p className="muted small">Sign in under Licence to use this.</p>
      ) : (
        <>
          <p className="small">
            {info === undefined ? 'Checking your account…' : info ? <>Saved from <strong>{info.savedFrom}</strong> on {when(info.savedAt)}: {info.templates} template{info.templates === 1 ? '' : 's'}{info.hasPin ? ', operator PIN' : ''}.</> : 'Nothing saved to your account yet.'}
          </p>
          <div className="row">
            <button className="btn" disabled={busy} onClick={() => run(async () => {
              const r = await window.booth.setupSave(includePin)
              setInfo(r)
              return `Saved ${r.templates} template${r.templates === 1 ? '' : 's'} and your booth preferences${r.hasPin ? ' and PIN' : ''}.`
            })}>{busy ? 'Working…' : "Save this computer's setup"}</button>
            <label className="check small"><input type="checkbox" checked={includePin} onChange={(e) => setIncludePin(e.target.checked)} /> Include the operator PIN</label>
          </div>
          {info && (
            <div className="field">
              <span className="field-label">Copy to this computer</span>
              <div className="row">
                <label className="check small"><input type="checkbox" checked={what.templates} onChange={(e) => setWhat({ ...what, templates: e.target.checked })} /> Templates</label>
                <label className="check small"><input type="checkbox" checked={what.prefs} onChange={(e) => setWhat({ ...what, prefs: e.target.checked })} /> Booth lock & pedal key</label>
                {info.hasPin && <label className="check small"><input type="checkbox" checked={what.pin} onChange={(e) => setWhat({ ...what, pin: e.target.checked })} /> Operator PIN</label>}
              </div>
              <button className="btn primary" disabled={busy || !(what.templates || what.prefs || what.pin)} onClick={() => confirm('Copy the saved setup onto this computer? Templates copied before are updated, not duplicated.') && run(async () => {
                const r = await window.booth.setupCopy(what)
                const parts = [r.templates ? `${r.templates} template${r.templates === 1 ? '' : 's'}` : '', r.prefs ? 'booth preferences' : '', r.pin ? 'operator PIN' : ''].filter(Boolean)
                return `Copied ${parts.join(', ') || 'nothing'}.${r.skipped.length ? ` Couldn't fetch the design for: ${r.skipped.join(', ')}. Save it again on the other computer.` : ''}`
              })}>Copy setup to this computer</button>
            </div>
          )}
          {msg && <p className="muted small">{msg}</p>}
        </>
      )}
    </div>
  )
}
