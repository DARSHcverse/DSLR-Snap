import { afterEach, describe, expect, it } from 'vitest'
import { parseAction, type RemoteAction, RemoteServer, type RemoteStatus } from '../src/main/remote/RemoteServer'

const KEY = 'k'.repeat(32)
const SESSION = '6f1c2a4e-8a0b-4c7e-9d3f-1b2c3d4e5f60'
const status: RemoteStatus = {
  eventName: 'Priya & Tom', eventMode: '360', paused: false,
  camera: { state: 'ready', detail: 'Canon EOS R100' }, printer: { state: 'ready', detail: 'DS-RX1', waiting: 0 },
  paper: { remaining: 412, capacity: 700 }, guests: 12, prints: 20, failedJobs: [], recent: [{ id: SESSION, at: '2026-10-31T20:00:00Z' }]
}

let server: RemoteServer | undefined
afterEach(async () => server?.stop())

async function start() {
  const acted: RemoteAction[] = []
  server = new RemoteServer({ status: async () => status, act: async (a) => void acted.push(a), thumb: async (id) => (id === SESSION ? Buffer.from('jpg') : null) }, KEY)
  const port = await server.start(0, '127.0.0.1')
  return { url: (path: string) => `http://127.0.0.1:${port}${path}`, acted }
}

describe('phone remote server', () => {
  it('serves the page, status and thumbnails with the right key', async () => {
    const { url } = await start()
    const page = await fetch(url(`/r/${KEY}`))
    expect(page.status).toBe(200)
    expect(await page.text()).toContain('DSLR Snap remote')
    expect(await (await fetch(url(`/r/${KEY}/status`))).json()).toMatchObject({ eventName: 'Priya & Tom', guests: 12 })
    expect((await fetch(url(`/r/${KEY}/thumb/${SESSION}`))).headers.get('content-type')).toBe('image/jpeg')
  })

  it('refuses a missing or wrong key, and old keys after the link is replaced', async () => {
    const { url } = await start()
    for (const p of ['/', '/r/', `/r/${'x'.repeat(32)}/status`, `/r/${KEY.slice(1)}/status`]) expect((await fetch(url(p))).status).toBe(404)
    server!.setKey('n'.repeat(32))
    expect((await fetch(url(`/r/${KEY}/status`))).status).toBe(404)
  })

  it('runs valid actions and rejects anything else', async () => {
    const { url, acted } = await start()
    const post = (body: unknown) => fetch(url(`/r/${KEY}/action`), { method: 'POST', body: JSON.stringify(body) })
    expect((await post({ action: 'start' })).status).toBe(200)
    expect((await post({ action: 'pause' })).status).toBe(200)
    expect((await post({ action: 'reprint', sessionId: SESSION })).status).toBe(200)
    expect((await post({ action: 'quit' })).status).toBe(400)
    expect((await post({ action: 'reprint', sessionId: '../../x' })).status).toBe(400)
    expect(acted).toEqual([{ action: 'start' }, { action: 'pause' }, { action: 'reprint', sessionId: SESSION }])
  })

  it('parses actions strictly', () => {
    expect(parseAction({ action: 'resume' })).toEqual({ action: 'resume' })
    expect(parseAction({ action: 'start' })).toEqual({ action: 'start' })
    expect(parseAction({ action: 'retry', jobId: 'nope' })).toBeNull()
    expect(parseAction(null)).toBeNull()
  })
})
