import { useEffect, useState } from 'react'
import type { DeviceSnapshot } from '@shared/api'
import { type FixTarget, readiness } from '@shared/readiness'
import type { AccountState, BoothEvent, EventStats } from '@shared/types'
import { message } from './Templates'

/**
 * The operator's first screen: one glance answers "can I open the doors?", and every problem
 * comes with its fix.
 */
export default function Home({ devices, account, onStart, onNavigate }: {
  devices: DeviceSnapshot | null
  account: AccountState | null
  onStart: () => void
  onNavigate: (target: Exclude<FixTarget, 'reconnect'>) => void
}) {
  const [active, setActive] = useState<{ event: BoothEvent; templateName: string } | null | undefined>(undefined)
  const [stats, setStats] = useState<EventStats | null>(null)
  const [disk, setDisk] = useState<number | undefined>(undefined)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    let eventId: string | undefined
    const loadStats = () => eventId && window.booth.eventStats(eventId).then(setStats).catch(() => undefined)
    window.booth.getActiveEvent().then((a) => {
      setActive(a ? { event: a.event, templateName: a.template.name } : null)
      eventId = a?.event.id
      void loadStats()
    })
    const loadDisk = () => window.booth.diskFree().then(setDisk).catch(() => undefined)
    void loadDisk()
    const t = setInterval(() => (void loadStats(), void loadDisk()), 30_000)
    const off = window.booth.onPrintJobs(() => void loadStats())
    return () => (clearInterval(t), off())
  }, [])

  if (active === undefined) return <div className="spinner" />
  const { ready, items } = readiness({ event: active?.event ?? null, templateName: active?.templateName, devices, account, stats, diskFreeBytes: disk })
  const problems = items.filter((i) => i.status !== 'ok').length

  const fix = async (target: FixTarget) => {
    if (target !== 'reconnect') return onNavigate(target)
    setNote('Reconnecting the camera…')
    await window.booth.reconnectCamera().catch((e) => setNote(message(e)))
    setNote(null)
  }
  const testPrint = async () => {
    setNote('Sending a 4×6 test print…')
    try {
      await window.booth.testPrint('4x6')
      setNote('Test print sent.')
    } catch (e) {
      setNote(message(e))
    }
  }

  return (
    <section className="home">
      <div className={`home-hero is-${ready ? (problems ? 'warn' : 'ok') : 'bad'}`}>
        <div>
          <p className="eyebrow">{active ? active.event.name : 'No event selected'}</p>
          <h1 className="home-title">
            {!ready ? 'Not ready yet' : problems ? 'Ready, with notes' : 'Ready to go'}
          </h1>
          <p className="muted">
            {!ready
              ? 'Fix the red items below before guests arrive.'
              : problems
                ? `The booth works. ${problems} thing${problems === 1 ? ' is' : 's are'} worth a look.`
                : 'Camera, printer and event are all set.'}
          </p>
        </div>
        <button className="btn primary huge-ish" onClick={onStart} disabled={!active}>▶ Start booth</button>
      </div>

      <div className="home-grid">
        <div className="launch-checks">
          {items.map((c) => (
            <div key={c.key} className={`check-row ${c.status}`}>
              <span className="check-icon">{c.status === 'ok' ? '✓' : c.status === 'warn' ? '!' : '✕'}</span>
              <div className="check-text"><strong>{c.label}</strong><div className="muted small">{c.detail}</div></div>
              {c.fix && <button className="btn small" onClick={() => fix(c.fix!.target)}>{c.fix.label}</button>}
            </div>
          ))}
          {note && <p className="muted small">{note}</p>}
        </div>

        <div className="home-side">
          {active && stats && (
            <div className="stat-grid compact">
              <div className="stat"><span className="stat-value">{stats.sessions}</span><span className="muted small">Guests so far</span></div>
              <div className="stat"><span className="stat-value">{stats.prints.sent}</span><span className="muted small">Prints</span></div>
            </div>
          )}
          <div className="card">
            <h3>Quick actions</h3>
            <button className="btn" onClick={() => onNavigate('events')}>{active ? 'Edit or switch event' : 'Create an event'}</button>
            <button className="btn" onClick={() => onNavigate('camera')}>Camera & test shot</button>
            <button className="btn" onClick={testPrint}>Test print 4×6</button>
          </div>
        </div>
      </div>
    </section>
  )
}
