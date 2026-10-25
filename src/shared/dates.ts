/** Today as YYYY-MM-DD in the computer's own time zone (toISOString() would give the UTC day). */
export function todayIso(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Formats a stored YYYY-MM-DD event date. Parsed as local midnight so it never shifts a day. */
export function formatEventDate(iso: string, opts: Intl.DateTimeFormatOptions): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', opts)
}
