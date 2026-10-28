import { cacheLife } from "next/cache";

/** Public release folder on Cloudflare R2 (the app's electron-builder.yml → publish.url). */
export const DOWNLOADS_URL = "https://downloads.dslrsnap.com/win";

export interface Release {
  version: string;
  url: string;
  sizeBytes: number | null;
  releasedAt: string | null;
}

/** The fields we need from electron-builder's latest.yml; null unless it's a sane installer in the folder. */
export function parseLatestYml(text: string, base: string): Release | null {
  const field = (name: string) => text.match(new RegExp(`^${name}:\\s*'?([^'\\n]+)'?\\s*$`, "m"))?.[1].trim();
  const version = field("version");
  const path = field("path");
  if (!version || !/^\d+\.\d+\.\d+([-.][\w.]+)?$/.test(version)) return null;
  if (!path || !/^[\w.-]+\.exe$/.test(path) || path.startsWith(".")) return null; // a plain file name, nothing else
  const size = text.match(/^\s+size:\s*(\d+)\s*$/m)?.[1];
  return { version, url: `${base}/${path}`, sizeBytes: size ? Number(size) : null, releasedAt: field("releaseDate") ?? null };
}

/** The newest Windows installer, checked at most hourly. Null before the first release (or if R2 is unreachable). */
export async function latestRelease(): Promise<Release | null> {
  "use cache";
  cacheLife("hours");
  try {
    const res = await fetch(`${DOWNLOADS_URL}/latest.yml`, { signal: AbortSignal.timeout(5000) });
    return res.ok ? parseLatestYml(await res.text(), DOWNLOADS_URL) : null;
  } catch {
    return null;
  }
}
