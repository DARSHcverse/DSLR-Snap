import { useEffect, useState } from 'react'
import type { DeviceSnapshot } from '@shared/api'
import type { DeviceSettings, EventStats, PrinterDetection, PrintJob, SessionRecord } from '@shared/types'
import AccountTab, { useAccount } from './Account'
import CameraSetup from './CameraSetup'
import EventsTab from './Events'
import TemplatesTab, { message } from './Templates'

type Tab = 'events' | 'templates' | 'camera' | 'devices' | 'prints' | 'sessions' | 'account'

export default function Admin({ onExit }: { onExit: () => void }) {
  const [tab, setTab] = useState<Tab>('events')
  const [devices, setDevices] = useState<DeviceSnapshot | null>(null)
  const account = useAccount()

  useEffect(() => {
    window.booth.getDevices().then(setDevices)
    return window.booth.onDevices(setDevices)
  }, [])

  return (
    <div className="admin">
      <header className="admin-bar">
        <strong>Operator</strong>
        <nav>
          {(['events', 'templates', 'camera', 'devices', 'prints', 'sessions', 'account'] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? 'tab active' : 'tab'} onClick={() => setTab(t)}>
              {{ events: 'Events', templates: 'Templates', camera: 'Camera', devices: 'Devices', prints: 'Print queue', sessions: 'Stats & photos', account: 'Account' }[t]}
            </button>
          ))}
        </nav>
        {devices && <StatusPills d={devices} />}
        {account?.mode === 'trial' && (
          <button className="pill busy" title={account.message} onClick={() => setTab('account')}>Trial: watermark on</button>
        )}
        <button className="btn primary" onClick={onExit}>Start booth</button>
      </header>
      <main className="admin-body">
        {tab === 'events' && <EventsTab devices={devices} onLaunch={onExit} />}
        {tab === 'templates' && <TemplatesTab />}
        {tab === 'camera' && <CameraSetup devices={devices} />}
        {tab === 'devices' && <DevicesTab devices={devices} />}
        {tab === 'prints' && <PrintsTab />}
        {tab === 'sessions' && <SessionsTab />}
        {tab === 'account' && <AccountTab />}
      </main>
    </div>
  )
}

function StatusPills({ d }: { d: DeviceSnapshot }) {
  const cls = (s: string) => (s === 'ready' ? 'ok' : s === 'busy' || s === 'connecting' ? 'busy' : 'bad')
  return (
    <div className="pills">
      <span className={`pill ${cls(d.camera.state)}`} title={d.camera.message}>Camera: {d.camera.state}</span>
      <span className={`pill ${cls(d.printer.state)}`} title={d.printer.message}>
        Printer: {d.printer.state}
        {d.printer.queueLength ? ` (${d.printer.queueLength})` : ''}
      </span>
      {d.uploads.enabled && (
        <span className={`pill ${d.uploads.failed ? 'bad' : d.uploads.pending ? 'busy' : 'ok'}`}>Uploads: {d.uploads.pending} pending</span>
      )}
    </div>
  )
}

function DevicesTab({ devices }: { devices: DeviceSnapshot | null }) {
  const [s, setS] = useState<DeviceSettings | null>(null)
  const [found, setFound] = useState<PrinterDetection | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const detect = () => window.booth.detectPrinters().then(setFound).catch(() => setFound(null))
  useEffect(() => {
    window.booth.getDeviceSettings().then(setS)
    void detect()
    // Pick up a printer plugged in while this screen is open.
    const t = setInterval(() => void detect(), 5000)
    return () => clearInterval(t)
  }, [])
  if (!s) return <div className="spinner" />

  const save = async (next: DeviceSettings) => {
    setS(next)
    await window.booth.saveDeviceSettings(next)
    void detect()
  }
  const printerField = (key: 'printerName4x6' | 'printerName2x6', label: string) => {
    const detected = key === 'printerName4x6' ? found?.queue4x6 : found?.queue2x6
    const installed = found?.installed ?? []
    return (
      <label>{label}
        <select value={s[key]} onChange={(e) => save({ ...s, [key]: e.target.value })}>
          <option value="">Automatic — {detected ?? 'no DNP printer found'}</option>
          {installed.map((p) => <option key={p} value={p}>{p}</option>)}
          {s[key] && !installed.includes(s[key]) && <option value={s[key]}>{s[key]} (not connected)</option>}
        </select>
      </label>
    )
  }
  const test = async (format: '4x6' | '2x6') => {
    setMsg(`Sending ${format} test print…`)
    try {
      await window.booth.testPrint(format)
      setMsg(`${format} test print sent. Check: red border just trimmed, blue box fully visible${format === '2x6' ? ', cut on the green line' : ''}.`)
    } catch (e) {
      setMsg(String(e))
    }
  }

  return (
    <section className="devices">
      <div className="card">
        <h3>Camera</h3>
        <p className="muted">{devices?.camera.model ?? '—'} · {devices?.camera.state}{devices?.camera.message ? ` · ${devices.camera.message}` : ''}</p>
        <label>Driver
          <select value={s.cameraDriver} onChange={(e) => save({ ...s, cameraDriver: e.target.value as DeviceSettings['cameraDriver'] })}>
            <option value="auto">Automatic (Canon over USB)</option>
            <option value="canon-edsdk">Canon EOS via USB (EDSDK)</option>
            <option value="mock">Mock camera (testing)</option>
          </select>
        </label>
        <button className="btn" onClick={() => window.booth.reconnectCamera()}>Reconnect camera</button>
      </div>
      <div className="card">
        <h3>Printer</h3>
        <p className="muted">{devices?.printer.printerName ?? '—'} · {devices?.printer.state}{devices?.printer.message ? ` · ${devices.printer.message}` : ''}</p>
        <label>Driver
          <select value={s.printerDriver} onChange={(e) => save({ ...s, printerDriver: e.target.value as DeviceSettings['printerDriver'] })}>
            <option value="auto">Automatic (DNP via Windows)</option>
            <option value="windows-driver">Windows printer driver (DNP)</option>
            <option value="mock">Mock printer (saves to folder)</option>
          </select>
        </label>
        {devices?.printer.driver === 'windows-driver' && (
          <>
            {printerField('printerName4x6', 'Printer for 4×6')}
            {printerField('printerName2x6', 'Printer for 2×6 strips')}
            {found?.stripsUncut && !s.printerName2x6 && (
              <p className="muted small">Strips will print as one uncut 4×6. To cut them automatically, add the DNP printer a second time with "2 inch cut" turned on.</p>
            )}
          </>
        )}
        <div className="row">
          <button className="btn" onClick={() => test('4x6')}>Test print 4×6</button>
          <button className="btn" onClick={() => test('2x6')}>Test print 2×6</button>
        </div>
        {msg && <p className="muted">{msg}</p>}
      </div>
      <div className="card">
        <h3>Digital delivery</h3>
        <p className="muted">
          {devices?.uploads.enabled
            ? `Cloud gallery connected · ${devices.uploads.done} uploaded, ${devices.uploads.pending} pending, ${devices.uploads.failed} retrying`
            : 'Not configured. Add SUPABASE_URL and SUPABASE_SERVICE_KEY to the .env file in the app data folder, then restart.'}
        </p>
      </div>
      <PinCard />
      <AppInfo />
    </section>
  )
}

function AppInfo() {
  const [info, setInfo] = useState<{ version: string; dataDir: string; logFile: string } | null>(null)
  useEffect(() => void window.booth.appInfo().then(setInfo), [])
  return (
    <div className="card">
      <h3>App</h3>
      {info && <p className="muted small">Version {info.version}<br />Photos: {info.dataDir}<br />Log: {info.logFile}</p>}
      <div className="row">
        <button className="btn" onClick={() => window.booth.openEventFolder('')}>Open photos folder</button>
        <button className="btn ghost danger" onClick={() => confirm('Quit the booth app?') && window.booth.quit()}>Quit app</button>
      </div>
    </div>
  )
}

function PrintsTab() {
  const [jobs, setJobs] = useState<PrintJob[]>([])
  useEffect(() => {
    const load = () => window.booth.listPrintJobs().then(setJobs)
    load()
    return window.booth.onPrintJobs(load)
  }, [])
  const label: Record<PrintJob['status'], string> = {
    queued: 'Queued', sending: 'Sending…', sent: 'Sent to printer', failed: 'Failed', needs_check: 'Check printer', cancelled: 'Cancelled'
  }
  return (
    <section>
      <h2>Print queue</h2>
      <p className="muted small">Failed jobs are never retried automatically, so nothing prints twice by accident. "Check printer" means the app closed mid-send — look at the printer before reprinting.</p>
      <table className="table">
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id}>
              <td><strong>{new Date(j.createdAt).toLocaleTimeString('en-GB')}</strong> · {j.format} · {j.copies} cop{j.copies > 1 ? 'ies' : 'y'}
                {j.lastError && <div className="warn small">{j.lastError}</div>}</td>
              <td><span className={`pill ${j.status === 'sent' ? 'ok' : j.status === 'failed' || j.status === 'needs_check' ? 'bad' : 'busy'}`}>{label[j.status]}</span></td>
              <td className="actions">
                {(j.status === 'failed' || j.status === 'needs_check') && <button className="btn small" onClick={() => window.booth.retryPrintJob(j.id)}>Retry</button>}
                {j.status === 'needs_check' && <button className="btn small ghost" onClick={() => window.booth.markPrintJobPrinted(j.id)}>It printed</button>}
                {(j.status === 'queued' || j.status === 'failed' || j.status === 'needs_check') && <button className="btn small ghost" onClick={() => window.booth.cancelPrintJob(j.id)}>Cancel</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {jobs.length === 0 && <p className="muted">No print jobs yet.</p>}
    </section>
  )
}

function SessionsTab() {
  const [eventId, setEventId] = useState<string | null>(null)
  const [eventName, setEventName] = useState('')
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [stats, setStats] = useState<EventStats | null>(null)
  const [originals, setOriginals] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const load = async () => {
    const a = await window.booth.getActiveEvent()
    if (!a) return
    setEventId(a.event.id)
    setEventName(a.event.name)
    setSessions(await window.booth.listSessions(a.event.id))
    setStats(await window.booth.eventStats(a.event.id))
  }
  useEffect(() => {
    void load()
    return window.booth.onPrintJobs(() => void load())
  }, [])

  const exportPhotos = async () => {
    if (!eventId) return
    setStatus('Choose a folder or USB stick…')
    try {
      const res = await window.booth.exportEventPhotos(eventId, originals)
      setStatus(res ? `Copied ${res.prints} print${res.prints === 1 ? '' : 's'}${originals ? ` and ${res.originals} original photo${res.originals === 1 ? '' : 's'}` : ''} to ${res.folder}${res.missing ? ` (${res.missing} file${res.missing === 1 ? '' : 's'} missing on disk)` : ''}.` : null)
    } catch (e) {
      setStatus(message(e))
    }
  }

  if (!eventId) return <p className="muted">No active event. Launch an event to see its stats.</p>
  const done = sessions.filter((s) => s.status === 'complete')
  return (
    <section className="stats">
      <h2>{eventName}</h2>
      {stats && (
        <div className="stat-grid">
          <Stat value={stats.sessions} label="Guest sessions" />
          <Stat value={stats.prints.sent} label="Prints sent" />
          <Stat value={stats.prints.pending + stats.prints.failed} label="Prints waiting or failed" bad={stats.prints.failed > 0} detail={stats.prints.lastError} />
          <Stat value={stats.uploads.done} label="QR downloads ready" bad={stats.uploads.failed > 0}
            detail={stats.uploads.failed || stats.uploads.pending ? `${stats.uploads.pending} uploading, ${stats.uploads.failed} retrying${stats.uploads.lastError ? ` · ${stats.uploads.lastError}` : ''}` : undefined} />
        </div>
      )}
      <div className="card">
        <h3>Give the client their photos</h3>
        <p className="muted small">Copies every finished design into a folder named after the event, for example on a USB stick. Run it again later to add new sessions.</p>
        <label className="check"><input type="checkbox" checked={originals} onChange={(e) => setOriginals(e.target.checked)} /> Include the original camera photos</label>
        <div className="row">
          <button className="btn primary" disabled={!done.length} onClick={exportPhotos}>Export photos…</button>
          <button className="btn ghost" onClick={() => window.booth.openEventFolder(eventId)}>Open data folder</button>
        </div>
        {status && <p className="muted small">{status}</p>}
      </div>
      <table className="table">
        <tbody>
          {done.map((s) => (
            <tr key={s.id}>
              <td>{new Date(s.createdAt).toLocaleTimeString('en-GB')} · {s.photoPaths.length} photos {s.galleryUrl ? '· uploaded' : ''}</td>
              <td className="actions"><button className="btn small" onClick={() => window.booth.reprint(s.id, crypto.randomUUID(), 1)}>Reprint</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function Stat({ value, label, bad, detail }: { value: number; label: string; bad?: boolean; detail?: string }) {
  return (
    <div className={`stat${bad ? ' bad' : ''}`}>
      <span className="stat-value">{value}</span>
      <span className="muted small">{label}</span>
      {detail && <span className={`small ${bad ? 'warn' : 'muted'}`}>{detail}</span>}
    </div>
  )
}

function PinCard() {
  const [has, setHas] = useState<boolean | null>(null)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  useEffect(() => void window.booth.hasPin().then(setHas), [])

  const save = async (value: string | null) => {
    try {
      await window.booth.setPin(has ? current : null, value)
      setHas(value !== null)
      setCurrent('')
      setNext('')
      setStatus(value === null ? 'PIN removed.' : 'PIN saved. It is needed to leave the booth screen.')
    } catch (e) {
      setStatus(message(e))
    }
  }
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 8)

  return (
    <div className="card">
      <h3>Operator PIN</h3>
      <p className="muted">{has ? 'Guests need this PIN to leave the booth screen.' : 'No PIN set: anyone can open this menu from the booth (hidden corner or Ctrl+Shift+A).'}</p>
      {has && <label>Current PIN<input type="password" inputMode="numeric" value={current} onChange={(e) => setCurrent(digits(e.target.value))} /></label>}
      <label>{has ? 'New PIN' : 'PIN (4 to 8 digits)'}<input type="password" inputMode="numeric" value={next} onChange={(e) => setNext(digits(e.target.value))} /></label>
      <div className="row">
        <button className="btn" disabled={next.length < 4 || (!!has && !current)} onClick={() => save(next)}>{has ? 'Change PIN' : 'Set PIN'}</button>
        {has && <button className="btn ghost danger" disabled={!current} onClick={() => save(null)}>Remove PIN</button>}
      </div>
      {status && <p className="muted small">{status}</p>}
    </div>
  )
}
