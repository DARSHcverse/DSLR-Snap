import "server-only";

/**
 * Cloudflare Turnstile: an invisible check that a real browser filled in the form. Off until both
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY are set (then the form shows the widget).
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
export const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const secret = process.env.TURNSTILE_SECRET_KEY ?? "";
export const turnstileEnabled = !!(turnstileSiteKey && secret);

export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  if (!turnstileEnabled) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, ...(ip !== "unknown" ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(8_000),
    });
    return ((await res.json()) as { success?: boolean }).success === true;
  } catch (e) {
    // Cloudflare unreachable: let the message through rather than lose a customer; the content filter still applies.
    console.error("turnstile:", e);
    return true;
  }
}
