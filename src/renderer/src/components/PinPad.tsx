import { useEffect, useState } from 'react'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK']

/** Full-screen keypad shown before the operator menu opens from the booth. */
export default function PinPad({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [lockedFor, setLockedFor] = useState(0)

  useEffect(() => {
    if (lockedFor <= 0) return
    const t = setTimeout(() => setLockedFor((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [lockedFor])

  const press = async (k: string) => {
    if (lockedFor > 0) return
    setError(null)
    if (k === '⌫') return setPin((p) => p.slice(0, -1))
    if (k !== 'OK') return setPin((p) => (p.length < 8 ? p + k : p))
    if (pin.length < 4) return setError('Enter at least 4 digits.')
    const res = await window.booth.verifyPin(pin)
    if (res.ok) return onSuccess()
    setPin('')
    if (res.lockedForSeconds) setLockedFor(res.lockedForSeconds)
    else setError('Wrong PIN.')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) void press(e.key)
      else if (e.key === 'Backspace') void press('⌫')
      else if (e.key === 'Enter') void press('OK')
      else if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="pinpad-backdrop">
      <div className="pinpad">
        <p className="eyebrow">Operator</p>
        <h2>Enter PIN</h2>
        <div className="pin-dots" aria-label={`${pin.length} digits entered`}>
          {Array.from({ length: Math.max(4, pin.length) }, (_, i) => <i key={i} className={i < pin.length ? 'on' : ''} />)}
        </div>
        <p className={`pin-msg ${error || lockedFor ? 'warn' : 'muted'}`}>
          {lockedFor > 0 ? `Too many tries. Wait ${lockedFor} s.` : (error ?? ' ')}
        </p>
        <div className="pin-keys">
          {KEYS.map((k) => (
            <button key={k} className={k === 'OK' ? 'ok' : ''} disabled={lockedFor > 0} onClick={() => press(k)}>{k}</button>
          ))}
        </div>
        <button className="btn ghost" onClick={onCancel}>Back to booth</button>
      </div>
    </div>
  )
}
