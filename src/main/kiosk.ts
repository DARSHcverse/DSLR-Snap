/** Kiosk lock rules, kept free of Electron so they're unit-tested. */

/** Only the installed app locks, so development stays usable. */
export function shouldLock(opts: { packaged: boolean; boothShowing: boolean; kioskLock: boolean }): boolean {
  return opts.packaged && opts.boothShowing && opts.kioskLock
}

export interface KeyInput {
  key: string
  alt: boolean
  control: boolean
  meta: boolean
  shift: boolean
}

/** Shortcuts that would close, quit, reload or inspect the app while guests use it. Ctrl+Shift+A (operator menu) stays. */
export function isBlockedWhileLocked(i: KeyInput): boolean {
  const k = i.key.toLowerCase()
  return (i.alt && k === 'f4') || ((i.control || i.meta) && ['w', 'q', 'r'].includes(k)) || k === 'f5' || k === 'f11' || (i.control && i.shift && k === 'i')
}
