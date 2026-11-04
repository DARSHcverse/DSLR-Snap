import { useState } from 'react'
import { cleanEmail } from '@shared/guestEmail'

const ROWS = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm']
const EXTRAS = ['@', '.', '_', '-', '.com', '.co.uk']

/**
 * "Email me my photos" on the done screen: a big on-screen keyboard (touch booths in kiosk mode
 * can't rely on Windows' own), a real keyboard works too. The marketing box is optional and starts
 * unticked; it only appears when the operator wrote its wording.
 */
export default function EmailSheet({ consentText, onSend, onClose }: {
  consentText: string
  onSend: (email: string, marketing: boolean) => Promise<void>
  onClose: () => void
}) {
  const [email, setEmail] = useState('')
  const [marketing, setMarketing] = useState(false)
  const [state, setState] = useState<'typing' | 'sending' | 'sent'>('typing')
  const [error, setError] = useState<string | null>(null)
  const valid = !!cleanEmail(email)
  const type = (k: string) => (setError(null), setEmail((e) => (e + k).slice(0, 254)))

  const send = async () => {
    if (!valid) return setError("That doesn't look like an email address yet.")
    setState('sending')
    try {
      await onSend(email, marketing)
      setState('sent')
      setTimeout(onClose, 2500)
    } catch (e) {
      setState('typing')
      setError(String(e instanceof Error ? e.message : e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    }
  }

  return (
    <div className="email-sheet" onClick={onClose}>
      <div className="email-card" onClick={(e) => e.stopPropagation()}>
        {state === 'sent' ? (
          <div className="email-sent">
            <h2 className="title">On its way!</h2>
            <p className="muted">Check your inbox for your photos.</p>
          </div>
        ) : (
          <>
            <h2 className="title">Email me my photos</h2>
            <input
              className="email-input"
              type="email"
              inputMode="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => (setError(null), setEmail(e.target.value.slice(0, 254)))}
              onKeyDown={(e) => e.key === 'Enter' && send()}
            />
            {error && <p className="warn small">{error}</p>}
            <div className="osk" aria-label="Keyboard">
              {ROWS.map((row) => (
                <div key={row} className="osk-row">
                  {row.split('').map((k) => <button key={k} type="button" onClick={() => type(k)}>{k}</button>)}
                </div>
              ))}
              <div className="osk-row">
                {EXTRAS.map((k) => <button key={k} type="button" className="wide" onClick={() => type(k)}>{k}</button>)}
                <button type="button" className="wide" onClick={() => setEmail((e) => e.slice(0, -1))} aria-label="Delete">⌫</button>
              </div>
            </div>
            {consentText && (
              <label className="check email-consent">
                <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} /> {consentText}
              </label>
            )}
            <p className="muted small">We only use your email to send your photos{consentText ? ', and for the above if you tick it' : ''}.</p>
            <div className="row">
              <button type="button" className="btn huge ghost" onClick={onClose}>Cancel</button>
              <button type="button" className="btn huge primary" disabled={!valid || state === 'sending'} onClick={send}>{state === 'sending' ? 'Sending…' : 'Send'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
