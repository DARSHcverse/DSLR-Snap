/**
 * Guests asking for their photos by email at the booth (with an optional, unticked marketing box
 * the operator words). Pure rules shared by the booth screen and the main process.
 */

const EMAIL = /^[a-z0-9._%+'-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/

/** A usable address, trimmed and lower-cased; null for anything else (typos, injected headers…). */
export function cleanEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase()
  return e.length <= 254 && EMAIL.test(e) ? e : null
}

export interface GuestContact {
  email: string
  marketing: boolean
  createdAt: string
}

/** Spreadsheet-safe cell: quoted when needed, and never starting a formula (=, +, -, @). */
function cell(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** The event's guest list for the operator (and their client): email, marketing choice, when. */
export function csvForContacts(rows: GuestContact[]): string {
  const lines = [['Email', 'Marketing consent', 'Time'], ...rows.map((r) => [r.email, r.marketing ? 'Yes' : 'No', r.createdAt.slice(0, 16).replace('T', ' ')])]
  return lines.map((l) => l.map(cell).join(',')).join('\r\n') + '\r\n'
}
