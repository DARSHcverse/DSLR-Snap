import { describe, expect, it } from 'vitest'
import { cleanEmail, csvForContacts } from '../src/shared/guestEmail'
import { GuestMailer, type PendingEmail } from '../src/main/guestMailer'

describe('cleanEmail', () => {
  it('accepts normal addresses, trimmed and lower-cased', () => {
    expect(cleanEmail('  Priya.Tom+booth@Example.co.uk ')).toBe('priya.tom+booth@example.co.uk')
  })
  it('refuses anything that is not an email', () => {
    for (const bad of ['', 'priya', 'priya@', '@x.com', 'a@b', 'a b@c.com', 'a@b.c', `${'x'.repeat(250)}@example.com`, 'a@b.com\nBcc: c@d.com']) expect(cleanEmail(bad)).toBeNull()
  })
})

describe('guest list CSV', () => {
  it('lists each guest with their marketing choice, quoting safely (no spreadsheet formulas)', () => {
    const csv = csvForContacts([
      { email: 'a@example.com', marketing: true, createdAt: '2026-11-04T20:15:00.000Z' },
      { email: '=cmd@example.com', marketing: false, createdAt: '2026-11-04T20:16:00.000Z' }
    ])
    expect(csv.split('\r\n')).toEqual(['Email,Marketing consent,Time', 'a@example.com,Yes,2026-11-04 20:15', "'=cmd@example.com,No,2026-11-04 20:16", ''])
  })
})

describe('GuestMailer', () => {
  const make = (online: () => boolean) => {
    const rows: PendingEmail[] = [{ id: 'g1', sessionId: 's1', email: 'a@example.com', eventName: 'Priya & Tom' }]
    const sent: string[] = []
    const mailer = new GuestMailer({
      pending: () => rows.filter((r) => !sent.includes(r.id)),
      markSent: (id) => void sent.push(id),
      markFailed: () => undefined,
      call: async <T,>(_p: string, body?: Record<string, unknown>) => {
        if (!online()) throw new Error('offline')
        expect(body).toMatchObject({ sessionId: 's1', email: 'a@example.com', event: 'Priya & Tom' })
        return { ok: true } as T
      }
    })
    return { mailer, sent }
  }

  it('sends waiting emails and marks them sent', async () => {
    const { mailer, sent } = make(() => true)
    await mailer.flush()
    expect(sent).toEqual(['g1'])
  })

  it('keeps them waiting while offline, then sends once back online', async () => {
    let up = false
    const { mailer, sent } = make(() => up)
    await mailer.flush()
    expect(sent).toEqual([])
    up = true
    await mailer.flush()
    expect(sent).toEqual(['g1'])
  })
})
