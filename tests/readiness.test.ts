import { describe, expect, it } from 'vitest'
import type { DeviceSnapshot } from '../src/shared/api'
import { readiness, type ReadinessInput } from '../src/shared/readiness'
import type { BoothEvent } from '../src/shared/types'

const GB = 1024 ** 3
const event: BoothEvent = {
  id: 'e1', name: 'Priya & Tom', date: '2026-10-27', templateId: 't', photosPerSession: 3, countdownSeconds: 3, retakesAllowed: 1,
  printCopies: 1, autoPrint: true, galleryEnabled: false, shotIntervalSeconds: 3, photoReviewSeconds: 3, doneScreenSeconds: 20,
  showGallery: true, look: 'glam', skinSmoothing: 50, colourCopy: false, boomerang: false, exposure: { iso: '400', aperture: '5.6', shutter: '1/125' },
  createdAt: '2026-10-27T10:00:00Z'
}
const devices: DeviceSnapshot = {
  camera: { driver: 'canon-edsdk', state: 'ready', model: 'Canon EOS R100', liveViewSupported: true },
  printer: { driver: 'windows-driver', state: 'ready', printerName: 'DS-RX1', queueLength: 0 },
  uploads: { enabled: false, pending: 0, failed: 0, done: 0 },
  paper: null
}
const stats = { sessions: 0, prints: { sent: 0, pending: 0, failed: 0 }, uploads: { done: 0, pending: 0, failed: 0 } }
const base: ReadinessInput = {
  event, templateName: 'Classic strip', devices, stats, diskFreeBytes: 80 * GB,
  account: { mode: 'licensed', message: 'Licensed', signedIn: true, canSignIn: true, email: 'op@example.com' }
}
const item = (input: ReadinessInput, key: string) => readiness(input).items.find((i) => i.key === key)

describe('readiness', () => {
  it('is ready when everything is connected and set', () => {
    const r = readiness(base)
    expect(r.ready).toBe(true)
    expect(r.items.every((i) => i.status === 'ok')).toBe(true)
    expect(item(base, 'event')?.detail).toBe('Priya & Tom · Classic strip · Glam B&W')
  })

  it('blocks when there is no event, camera or printer, and offers the fix', () => {
    expect(readiness({ ...base, event: null })).toMatchObject({ ready: false })
    const noCam = { ...base, devices: { ...devices, camera: { ...devices.camera, state: 'disconnected' as const, message: undefined } } }
    expect(item(noCam, 'camera')).toMatchObject({ status: 'bad', fix: { target: 'reconnect' } })
    const noPrinter = { ...base, devices: { ...devices, printer: { ...devices.printer, state: 'disconnected' as const, message: 'No DNP printer found.' } } }
    expect(item(noPrinter, 'printer')).toMatchObject({ status: 'bad', detail: 'No DNP printer found.', fix: { target: 'devices' } })
    expect(readiness(noPrinter).ready).toBe(false)
  })

  it('does not need a printer when the event prints nothing', () => {
    const noPrint = { ...base, event: { ...event, printCopies: 0 }, devices: { ...devices, printer: { ...devices.printer, state: 'disconnected' as const } } }
    expect(readiness(noPrint).ready).toBe(true)
  })

  it('warns, without blocking, about failed prints, missing exposure, trial mode and QR without a gallery', () => {
    const r = readiness({
      ...base,
      event: { ...event, exposure: undefined, galleryEnabled: true },
      stats: { ...stats, prints: { sent: 3, pending: 0, failed: 2, lastError: 'Out of paper' } },
      account: { mode: 'trial', message: 'Trial mode: photos carry a watermark.', signedIn: false, canSignIn: true }
    })
    expect(r.ready).toBe(true)
    const warn = Object.fromEntries(r.items.filter((i) => i.status === 'warn').map((i) => [i.key, i.fix?.target]))
    expect(warn).toEqual({ exposure: 'camera', printer: 'prints', uploads: 'account', licence: 'account' })
    expect(r.items.find((i) => i.key === 'printer')?.detail).toBe('2 prints failed: Out of paper')
  })

  it('tracks paper once a roll is recorded', () => {
    const withPaper = (remaining: number) => ({ ...base, devices: { ...devices, paper: { capacity: 700, used: 700 - remaining, remaining, loadedAt: '' } } })
    expect(item(base, 'paper')).toBeUndefined()
    expect(item(withPaper(412), 'paper')).toMatchObject({ status: 'ok', detail: '412 of 700 prints left on the roll' })
    expect(item(withPaper(30), 'paper')).toMatchObject({ status: 'warn', fix: { target: 'devices' } })
    expect(item(withPaper(0), 'paper')?.status).toBe('bad')
    expect(readiness(withPaper(0)).ready).toBe(false)
  })

  it('checks free disk space', () => {
    expect(item({ ...base, diskFreeBytes: 1 * GB }, 'disk')?.status).toBe('bad')
    expect(item({ ...base, diskFreeBytes: 5.5 * GB }, 'disk')).toMatchObject({ status: 'warn', detail: expect.stringContaining('5.5 GB free') })
  })

  it('leaves the licence out of developer builds', () => {
    expect(item({ ...base, account: { mode: 'dev', message: '', signedIn: false, canSignIn: false } }, 'licence')).toBeUndefined()
  })
})
