/**
 * Validation for what booth computers sync to the account. Pure, so it's unit tested; the API
 * route never stores anything that didn't pass through here.
 */
export interface SyncedPreset {
  id: string;
  name: string;
  settings: Partial<Record<"iso" | "aperture" | "shutter" | "whiteBalance", string>>;
}

export const MAX_SYNCED_PRESETS = 12;
const KEYS = ["iso", "aperture", "shutter", "whiteBalance"] as const;
const VALUE = /^[\w./"+ -]{1,16}$/;
const ID = /^[\w-]{1,64}$/;

/** The app's "My settings" list, cleaned; null when it isn't a list at all. */
export function cleanPresets(raw: unknown): SyncedPreset[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const out: SyncedPreset[] = [];
  for (const p of raw.slice(0, MAX_SYNCED_PRESETS * 2)) {
    if (!p || typeof p !== "object") continue;
    const { id, name, settings } = p as Record<string, unknown>;
    const n = typeof name === "string" ? name.trim().replace(/\s+/g, " ").slice(0, 40) : "";
    if (!n || typeof id !== "string" || !ID.test(id) || seen.has(n.toLowerCase())) continue;
    const clean: SyncedPreset["settings"] = {};
    for (const k of KEYS) {
      const v = (settings as Record<string, unknown> | undefined)?.[k];
      if (typeof v === "string" && VALUE.test(v)) clean[k] = v;
    }
    seen.add(n.toLowerCase());
    out.push({ id, name: n, settings: clean });
  }
  return out.slice(-MAX_SYNCED_PRESETS);
}
