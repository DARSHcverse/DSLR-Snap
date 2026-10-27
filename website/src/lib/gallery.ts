import { randomBytes } from "node:crypto";

// Pure rules for the guest and host galleries. Database and storage calls live in the route handlers.

export const GALLERY_BUCKET = "galleries";
export const RETENTION_DAYS = 365;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export type GalleryFileKind = "photo" | "colour" | "gif" | "boomerang";
export interface GalleryFile {
  kind: GalleryFileKind;
  path: string;
  contentType: string;
}

const KINDS: Record<GalleryFileKind, { contentType: string; ext: string }> = {
  photo: { contentType: "image/jpeg", ext: "jpg" },
  colour: { contentType: "image/jpeg", ext: "jpg" },
  gif: { contentType: "image/gif", ext: "gif" },
  boomerang: { contentType: "image/gif", ext: "gif" },
};

export const isUuid = (s: unknown): s is string =>
  typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export interface UploadRequest {
  sessionId: string;
  event: { id: string; name: string; date: string | null };
  files: { kind: GalleryFileKind; contentType: string; bytes: number }[];
}

/** Validates what the booth asks to upload. Returns a message for the operator when it's wrong. */
export function parseUploadRequest(body: Record<string, unknown> | null): UploadRequest | { error: string } {
  const ev = (body?.event ?? {}) as Record<string, unknown>;
  if (!isUuid(body?.sessionId)) return { error: "Bad session id." };
  if (!isUuid(ev.id)) return { error: "Bad event id." };
  const name = typeof ev.name === "string" ? ev.name.trim().slice(0, 120) : "";
  const date = typeof ev.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ev.date) ? ev.date : null;
  const files = Array.isArray(body?.files) ? (body.files as Record<string, unknown>[]) : [];
  if (!files.length || files.length > Object.keys(KINDS).length) return { error: "Nothing to upload." };
  const seen = new Set<string>();
  const parsed: UploadRequest["files"] = [];
  for (const f of files) {
    const kind = f.kind as GalleryFileKind;
    if (!(kind in KINDS) || seen.has(kind)) return { error: "Unknown file type." };
    if (f.contentType !== KINDS[kind].contentType) return { error: "Wrong file format." };
    if (typeof f.bytes !== "number" || f.bytes <= 0 || f.bytes > MAX_FILE_BYTES) return { error: "File too large." };
    seen.add(kind);
    parsed.push({ kind, contentType: KINDS[kind].contentType, bytes: f.bytes });
  }
  if (!seen.has("photo")) return { error: "The photo is missing." };
  return { sessionId: body!.sessionId as string, event: { id: ev.id as string, name: name || "Event", date }, files: parsed };
}

/** Storage path: owner/event/session/kind. The session id is random, so paths can't be guessed. */
export function storagePath(userId: string, eventId: string, sessionId: string, kind: GalleryFileKind): string {
  return `${userId}/${eventId}/${sessionId}/${kind}.${KINDS[kind].ext}`;
}

/** Unguessable token for the host's event link (/e/…). */
export function makeShareToken(): string {
  return randomBytes(12).toString("base64url");
}

export const isShareToken = (s: unknown): s is string => typeof s === "string" && /^[A-Za-z0-9_-]{16}$/.test(s);

export function isExpired(createdAt: string, now: number): boolean {
  return now - Date.parse(createdAt) > RETENTION_DAYS * 86_400_000;
}

/** How each file is offered to guests, in page order. */
export function describeFiles(files: GalleryFile[]): { kind: GalleryFileKind; label: string; filename: string }[] {
  const hasColour = files.some((f) => f.kind === "colour");
  const order: GalleryFileKind[] = ["photo", "colour", "boomerang", "gif"];
  return order
    .filter((k) => files.some((f) => f.kind === k))
    .map((kind) => ({
      kind,
      label: { photo: hasColour ? "Black & white" : "Your photo strip", colour: "Colour", boomerang: "Boomerang", gif: "Animated GIF" }[kind],
      filename: { photo: "dslr-snap.jpg", colour: "dslr-snap-colour.jpg", boomerang: "dslr-snap-boomerang.gif", gif: "dslr-snap.gif" }[kind],
    }));
}
