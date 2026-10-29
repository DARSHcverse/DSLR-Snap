import "server-only";
import { DeleteObjectsCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { supabaseConfig } from "./config";
import { GALLERY_BUCKET } from "./gallery";
import { supabaseAdmin } from "./supabase/server";

/**
 * Where guest photos and videos live: Cloudflare R2 when GALLERY_R2_* is set (free downloads, which
 * matter once galleries are busy), otherwise Supabase Storage. Both are private; everything is
 * reached through short-lived signed links. Pages and routes only use this module.
 */
const env = process.env;
const r2 =
  env.GALLERY_R2_ACCOUNT_ID && env.GALLERY_R2_ACCESS_KEY_ID && env.GALLERY_R2_SECRET_ACCESS_KEY && env.GALLERY_R2_BUCKET
    ? {
        bucket: env.GALLERY_R2_BUCKET,
        client: new S3Client({
          region: "auto",
          // EU-jurisdiction buckets live on their own endpoint.
          endpoint: `https://${env.GALLERY_R2_ACCOUNT_ID}.${env.GALLERY_R2_JURISDICTION === "eu" ? "eu." : ""}r2.cloudflarestorage.com`,
          credentials: { accessKeyId: env.GALLERY_R2_ACCESS_KEY_ID, secretAccessKey: env.GALLERY_R2_SECRET_ACCESS_KEY },
        }),
      }
    : null;

export const storageBackend: "r2" | "supabase" = r2 ? "r2" : "supabase";

const LINK_SECONDS = 60 * 60;
const UPLOAD_SECONDS = 2 * 60 * 60;

/** One-time upload link the booth PUTs a file to, plus any headers it must send. */
export async function uploadUrl(path: string, contentType: string): Promise<{ url: string; headers: Record<string, string> }> {
  if (r2) {
    const url = await getSignedUrl(r2.client, new PutObjectCommand({ Bucket: r2.bucket, Key: path, ContentType: contentType }), { expiresIn: UPLOAD_SECONDS });
    return { url, headers: {} };
  }
  const { data, error } = await supabaseAdmin().storage.from(GALLERY_BUCKET).createSignedUploadUrl(path, { upsert: true });
  if (error || !data) throw new Error(`upload link: ${error?.message}`);
  // The publishable key is public; Supabase's storage gateway may want it alongside the signed token.
  return { url: data.signedUrl, headers: { apikey: supabaseConfig!.publishableKey } };
}

/** Signed links to view (and optionally download, under a friendly name) a set of files. */
export async function viewUrls(paths: string[], download?: (path: string) => string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!paths.length) return out;
  if (r2) {
    await Promise.all(
      paths.map(async (p) => {
        const name = download?.(p);
        const cmd = new GetObjectCommand({ Bucket: r2.bucket, Key: p, ...(name ? { ResponseContentDisposition: `attachment; filename="${name.replace(/"/g, "")}"` } : {}) });
        out.set(p, await getSignedUrl(r2.client, cmd, { expiresIn: LINK_SECONDS }));
      }),
    );
    return out;
  }
  const bucket = supabaseAdmin().storage.from(GALLERY_BUCKET);
  if (download) {
    await Promise.all(
      paths.map(async (p) => {
        const { data } = await bucket.createSignedUrl(p, LINK_SECONDS, { download: download(p) });
        if (data?.signedUrl) out.set(p, data.signedUrl);
      }),
    );
    return out;
  }
  for (let i = 0; i < paths.length; i += 500) {
    const { data } = await bucket.createSignedUrls(paths.slice(i, i + 500), LINK_SECONDS);
    for (const s of data ?? []) if (s.path && s.signedUrl) out.set(s.path, s.signedUrl);
  }
  return out;
}

/** A file's bytes as a stream (for "download all"). */
export async function openFile(path: string): Promise<ReadableStream<Uint8Array> | null> {
  if (r2) {
    const res = await r2.client.send(new GetObjectCommand({ Bucket: r2.bucket, Key: path })).catch(() => null);
    return (res?.Body?.transformToWebStream() as ReadableStream<Uint8Array> | undefined) ?? null;
  }
  const url = (await viewUrls([path])).get(path);
  const res = url ? await fetch(url).catch(() => null) : null;
  return res?.ok && res.body ? res.body : null;
}

/** Deletes files; throws if the storage refused, so callers keep their records and retry. */
export async function removeFiles(paths: string[]): Promise<void> {
  for (let i = 0; i < paths.length; i += 1000) {
    const chunk = paths.slice(i, i + 1000);
    if (r2) {
      const res = await r2.client.send(new DeleteObjectsCommand({ Bucket: r2.bucket, Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true } }));
      if (res.Errors?.length) throw new Error(`delete: ${res.Errors[0].Message}`);
    } else {
      const { error } = await supabaseAdmin().storage.from(GALLERY_BUCKET).remove(chunk);
      if (error) throw new Error(`delete: ${error.message}`);
    }
  }
}
