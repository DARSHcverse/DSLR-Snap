import { type ReactNode, useEffect, useState } from 'react'
import type { DeviceSnapshot } from '@shared/api'
import type { DeviceSettings, DeviceState, EventStats, PrinterDetection, PrintJob, SessionRecord } from '@shared/types'
import AccountTab, { useAccount } from './Account'
import CameraSetup from './CameraSetup'
import EventsTab from './Events'
import Home from './Home'
import TemplatesTab, { message } from './Templates'

type Tab = 'home' | 'events' | 'templates' | 'prints' | 'sessions' | 'camera' | 'devices' | 'account'

/** Sidebar groups follow when the operator needs them: set up an event, run it, then rarely-touched setup. */
const NAV: { group?: string; items: { tab: Tab; label: string; icon: ReactNode }[] }[] = [
  { items: [{ tab: 'home', label: 'Home', icon: <path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /> }] },
  {
    group: 'Event',
    items: [
      { tab: 'events', label: 'Events', icon: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></> },
      { tab: 'templates', label: 'Templates', icon: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 9v12" /></> }
    ]
  },
  {
    group: 'During the event',
    items: [
      { tab: 'prints', label: 'Print queue', icon: <><path d="M7 9V4h10v5" /><rect x="3" y="9" width="18" height="8" rx="1.5" /><path d="M7 14h10v6H7z" /></> },
      { tab: 'sessions', label: 'Photos & stats', icon: <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></> }
    ]
  },
  {
    group: 'Setup',
    items: [
      { tab: 'camera', label: 'Camera', icon: <><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13" r="3.5" /></> },
      { tab: 'devices', label: 'Printer & devices', icon: <><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" /><circle cx="12" cy="12" r="3" /></> },
      { tab: 'account', label: 'Account', icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></> }
    ]
  }
]

const dot = (s?: DeviceState) => (s === 'ready' ? 'ok' : s === 'busy' || s === 'connecting' ? 'busy' : 'bad')

export default function Admin({ onExit }: { onExit: () => void }) {
  const [tab, setTab] = useState<Tab>('home')
  const [devices, setDevices] = useState<DeviceSnapshot | null>(null)
  const [failedPrints, setFailedPrints] = useState(0)
  const account = useAccount()

  useEffect(() => {
    window.booth.getDevices().then(setDevices)
    return window.booth.onDevices(setDevices)
  }, [])
  useEffect(() => {
    const load = () =>
      window.booth.listPrintJobs().then((jobs) => setFailedPrints(jobs.filter((j) => j.status === 'failed' || j.status === 'needs_check').length))
    void load()
    return window.booth.onPrintJobs(() => void load())
  }, [])

  /** Small status shown next to a menu item: a coloured dot or a count. */
  const marker = (t: Tab): ReactNode => {
    if (t === 'camera') return <span className={`side-dot ${dot(devices?.camera.state)}`} title={devices?.camera.state} />
    if (t === 'devices') return <span className={`side-dot ${dot(devices?.printer.state)}`} title={devices?.printer.state} />
    if (t === 'prints') {
      if (failedPrints) return <span className="side-badge bad">{failedPrints}</span>
      if (devices?.printer.queueLength) return <span className="side-badge">{devices.printer.queueLength}</span>
    }
    if (t === 'account' && account?.mode === 'trial') return <span className="side-badge busy">Trial</span>
    return null
  }

  return (
    <div className="admin">
      <aside className="side">
        <div className="side-brand">
          <img src="/logo-wordmark.png" alt="DSLR Snap" />
          <span className="muted small">Operator</span>
        </div>
        <nav className="side-nav">
          {NAV.map((g, i) => (
            <div key={g.group ?? i} className="side-group">
              {g.group && <p className="side-label">{g.group}</p>}
              {g.items.map((it) => (
                <button key={it.tab} className={`side-item ${tab === it.tab ? 'on' : ''}`} onClick={() => setTab(it.tab)} title={it.label}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{it.icon}</svg>
                  <span className="side-text">{it.label}</span>
                  {marker(it.tab)}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <button className="btn primary side-start" onClick={onExit}>▶ <span className="side-text">Start booth</span></button>
      </aside>
      <main className="admin-body">
        {tab === 'home' && <Home devices={devices} account={account} onStart={onExit} onNavigate={setTab} />}
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
            : 'Off. QR downloads and the host gallery need this booth signed in with an active plan (Account).'}
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
      <HostGallery eventId={eventId} />
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

/** The host's shareable page with every photo of the event: show the QR at the end of the night, or send the link. */
function HostGallery({ eventId }: { eventId: string }) {
  const [link, setLink] = useState<{ url: string; qr: string } | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const get = async () => {
    setStatus('Creating the link…')
    try {
      setLink(await window.booth.eventGalleryLink(eventId))
      setStatus(null)
    } catch (e) {
      setStatus(message(e))
    }
  }
  return (
    <div className="card">
      <h3>Host gallery</h3>
      <p className="muted small">One page with every photo from this event, for the couple or client. Photos appear as they upload and stay online for a year.</p>
      {link ? (
        <div className="row host-link">
          <img src={link.qr} alt="QR code for the host gallery" />
          <div className="field">
            <code className="small">{link.url}</code>
            <div className="row">
              <button className="btn small" onClick={() => void navigator.clipboard.writeText(link.url).then(() => setStatus('Link copied.'))}>Copy link</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="row"><button className="btn" onClick={get}>Get host gallery link</button></div>
      )}
      {status && <p className="muted small">{status}</p>}
    </div>
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
