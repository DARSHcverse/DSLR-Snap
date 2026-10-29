import "server-only";
import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { passCookieName, passwordPass, type PublicEvent } from "@/lib/galleryServer";

/** Whether this browser may see a password-protected event (no password = always). */
export async function hasAccess(event: PublicEvent): Promise<boolean> {
  if (!event.passwordHash) return true;
  const given = Buffer.from((await cookies()).get(passCookieName(event.id))?.value ?? "");
  const expected = Buffer.from(passwordPass(event.id, event.passwordHash));
  return given.length === expected.length && timingSafeEqual(given, expected);
}
