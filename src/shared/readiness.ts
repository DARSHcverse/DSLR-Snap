import type { DeviceSnapshot } from './api'
import { describeExposure } from './exposure'
import { lookInfo } from './looks'
import type { AccountState, BoothEvent, EventStats } from './types'

/** Where a "Fix" button takes the operator. 'reconnect' retries the camera in place. */
export type FixTarget = 'events' | 'camera' | 'devices' | 'prints' | 'account' | 'reconnect'

export interface CheckItem {
  key: string
  status: 'ok' | 'warn' | 'bad'
  label: string
  detail: string
  fix?: { label: string; target: FixTarget }
}

export interface ReadinessInput {
  event: BoothEvent | null
  templateName?: string
  devices: DeviceSnapshot | null
  account: AccountState | null
  stats: EventStats | null
  diskFreeBytes?: number
}

const GB = 1024 ** 3

/**
 * The Home screen's "can I open the doors?" checklist. 'bad' blocks a smooth event (guests would
 * hit errors); 'warn' works but deserves a look. Pure, so every rule is unit-tested.
 */
export function readiness(input: ReadinessInput): { ready: boolean; items: CheckItem[] } {
  const { event, devices, account, stats, diskFreeBytes } = input
  const items: CheckItem[] = []

  items.push(
    event
      ? { key: 'event', status: 'ok', label: 'Event', detail: [event.name, input.templateName, lookInfo(event.look).label].filter(Boolean).join(' · ') }
      : { key: 'event', status: 'bad', label: 'Event', detail: 'No event selected', fix: { label: 'Choose an event', target: 'events' } }
  )

  const cam = devices?.camera
  if (!cam) items.push({ key: 'camera', status: 'warn', label: 'Camera', detail: 'Checking…' })
  else if (cam.state === 'ready' || cam.state === 'busy') items.push({ key: 'camera', status: 'ok', label: 'Camera', detail: cam.model ?? 'Connected' })
  else if (cam.state === 'connecting') items.push({ key: 'camera', status: 'warn', label: 'Camera', detail: 'Connecting…' })
  else items.push({ key: 'camera', status: 'bad', label: 'Camera', detail: cam.message ?? 'Not connected. Check the USB cable and that the camera is on.', fix: { label: 'Reconnect', target: 'reconnect' } })

  if (event) {
    items.push(
      event.exposure
        ? { key: 'exposure', status: 'ok', label: 'Exposure', detail: describeExposure(event.exposure) }
        : { key: 'exposure', status: 'warn', label: 'Exposure', detail: "Not set for this venue: the camera's own settings will be used", fix: { label: 'Set exposure', target: 'camera' } }
    )
  }

  const printer = devices?.printer
  const failed = stats?.prints.failed ?? 0
  if (event && event.printCopies === 0) {
    items.push({ key: 'printer', status: 'ok', label: 'Printer', detail: 'Printing is off for this event' })
  } else if (!printer) {
    items.push({ key: 'printer', status: 'warn', label: 'Printer', detail: 'Checking…' })
  } else if (printer.state === 'disconnected' || printer.state === 'error') {
    items.push({ key: 'printer', status: 'bad', label: 'Printer', detail: printer.message ?? 'Not ready', fix: { label: 'Printer settings', target: 'devices' } })
  } else if (failed > 0) {
    items.push({ key: 'printer', status: 'warn', label: 'Printer', detail: `${failed} print${failed === 1 ? '' : 's'} failed${stats?.prints.lastError ? `: ${stats.prints.lastError}` : ''}`, fix: { label: 'Open print queue', target: 'prints' } })
  } else {
    const waiting = printer.queueLength ? ` · ${printer.queueLength} waiting` : ''
    items.push({ key: 'printer', status: 'ok', label: 'Printer', detail: `${printer.printerName ?? 'Ready'}${waiting}${printer.message ? ` · ${printer.message}` : ''}` })
  }

  if (event?.galleryEnabled) {
    const up = devices?.uploads
    if (!up?.enabled) {
      items.push({ key: 'uploads', status: 'warn', label: 'QR downloads', detail: 'Off: QR downloads need this booth signed in with an active plan', fix: { label: 'Account', target: 'account' } })
    }
    else if (up.failed) items.push({ key: 'uploads', status: 'warn', label: 'QR downloads', detail: `${up.failed} upload${up.failed === 1 ? '' : 's'} retrying (check the internet connection)` })
    else items.push({ key: 'uploads', status: 'ok', label: 'QR downloads', detail: up.pending ? `${up.pending} uploading` : 'On' })
  }

  if (diskFreeBytes !== undefined) {
    const free = `${(diskFreeBytes / GB).toFixed(diskFreeBytes < 10 * GB ? 1 : 0)} GB free`
    if (diskFreeBytes < 2 * GB) items.push({ key: 'disk', status: 'bad', label: 'Storage', detail: `${free}: photos may stop saving. Free up space or export old events.` })
    else if (diskFreeBytes < 10 * GB) items.push({ key: 'disk', status: 'warn', label: 'Storage', detail: `${free}: enough for one event, but clear space soon` })
    else items.push({ key: 'disk', status: 'ok', label: 'Storage', detail: free })
  }

  if (account && account.mode !== 'dev') {
    items.push(
      account.mode === 'licensed'
        ? { key: 'licence', status: 'ok', label: 'Licence', detail: account.email ? `Licensed · ${account.email}` : 'Licensed' }
        : { key: 'licence', status: 'warn', label: 'Licence', detail: account.message, fix: { label: 'Account', target: 'account' } }
    )
  }

  return { ready: !items.some((i) => i.status === 'bad'), items }
}
