import { useEffect, useRef, useState } from 'react'
import Admin from './admin/Admin'
import PinPad from './components/PinPad'
import Booth from './screens/Booth'

/**
 * Two modes: the guest-facing Booth and the operator Admin.
 * Operators open Admin with Ctrl+Shift+A or five quick taps in the top-left corner;
 * if an operator PIN is set, a keypad asks for it first.
 */
export default function App() {
  const [mode, setMode] = useState<'booth' | 'pin' | 'admin'>('booth')
  const modeRef = useRef(mode)
  modeRef.current = mode
  const taps = useRef<number[]>([])

  const openAdmin = async () => setMode((await window.booth.hasPin().catch(() => false)) ? 'pin' : 'admin')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a')) return
      if (modeRef.current === 'booth') void openAdmin()
      else setMode('booth')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const secretTap = () => {
    const now = Date.now()
    taps.current = [...taps.current.filter((t) => now - t < 2500), now]
    if (taps.current.length >= 5) {
      taps.current = []
      void openAdmin()
    }
  }

  return (
    <>
      {mode === 'admin' ? <Admin onExit={() => setMode('booth')} /> : <Booth onNeedSetup={() => void openAdmin()} />}
      {mode === 'booth' && <button className="secret-corner" aria-label="Operator menu" onPointerDown={secretTap} />}
      {mode === 'pin' && <PinPad onSuccess={() => setMode('admin')} onCancel={() => setMode('booth')} />}
    </>
  )
}
