import { setUpdatesByToken } from "@/lib/email/preferences";

/** One-click unsubscribe (RFC 8058): Gmail and Apple Mail POST here from their own "Unsubscribe" button. */
export async function POST(request: Request) {
  const ok = await setUpdatesByToken(new URL(request.url).searchParams.get("t"), false);
  return new Response(null, { status: ok ? 200 : 404 });
}
