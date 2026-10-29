"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyPassword } from "@/lib/admin/crypto";
import { isShareToken } from "@/lib/gallery";
import { passCookieName, passwordPass, publicEventByToken } from "@/lib/galleryServer";
import { overLimitHere } from "@/lib/rateLimit";

export type UnlockResult = { error: string } | null;

/** The event's password: right → a 30-day cookie for this event; wrong → try again (rate-limited). */
export async function unlockGallery(_prev: UnlockResult, form: FormData): Promise<UnlockResult> {
  const token = String(form.get("token") ?? "");
  if (!isShareToken(token)) return { error: "This link isn't valid." };
  if (await overLimitHere("login")) return { error: "Too many attempts. Wait a few minutes." };
  const event = await publicEventByToken(token);
  if (!event?.passwordHash || !event.linkEnabled) redirect(`/e/${token}`);
  if (!verifyPassword(String(form.get("password") ?? ""), event.passwordHash)) return { error: "That password isn't right." };
  (await cookies()).set(passCookieName(event.id), passwordPass(event.id, event.passwordHash), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/e/${token}`,
    maxAge: 30 * 86_400,
  });
  redirect(`/e/${token}`);
}
