/**
 * Windows' own "Printing Preferences" for one printer, where the DNP driver keeps "2inch cut".
 * `rundll32 printui.dll,PrintUIEntry /e /n <name>` opens exactly that dialog and keeps running
 * until the operator presses OK or Cancel, so the app can wait and then come back to the front.
 */
export function printerPreferencesCommand(printerName: string): { file: string; args: string[] } {
  if (!printerName.trim()) throw new Error('No printer selected.')
  // Run without a shell: the name is one argument, so quotes or & in it can't run anything else.
  return { file: 'rundll32.exe', args: ['printui.dll,PrintUIEntry', '/e', '/n', printerName] }
}

/** Which printer entry to open for a format, and what the operator should set "2inch cut" to. */
export function preferencesTarget(
  detected: { queue4x6?: string; queue2x6?: string },
  format: '4x6' | '2x6'
): { printer: string; cut: 'on' | 'off'; sharedQueue: boolean } | null {
  const printer = format === '2x6' ? detected.queue2x6 ?? detected.queue4x6 : detected.queue4x6
  if (!printer) return null
  const sharedQueue = !detected.queue2x6 || detected.queue2x6 === detected.queue4x6
  return { printer, cut: format === '2x6' ? 'on' : 'off', sharedQueue }
}
