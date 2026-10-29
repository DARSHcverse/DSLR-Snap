"use server";

import { redirect } from "next/navigation";
import { brandImageUpload, resetEventDesign, saveEventDesign } from "@/lib/cloudDesign";
import { finishManualUploads, getEvent, startManualUploads } from "@/lib/cloudEvents";
import { parseDesign } from "@/lib/design";
import { isUuid } from "@/lib/gallery";
import { getCurrentUser } from "@/lib/supabase/server";

async function ownerOf(eventId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/events");
  if (!isUuid(eventId) || !(await getEvent(user.id, eventId))) redirect("/account/events");
  return user.id;
}

/** A one-time link for the browser to send a banner, logo or background straight to storage. */
export async function startBrandUpload(eventId: string, contentType: string, bytes: number): Promise<{ path: string; url: string; headers: Record<string, string> } | { error: string }> {
  const userId = await ownerOf(eventId);
  try {
    return await brandImageUpload(userId, contentType, bytes);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't start the upload." };
  }
}

export async function saveDesign(eventId: string, designJson: string, makeDefault: boolean): Promise<{ ok: true } | { error: string }> {
  const userId = await ownerOf(eventId);
  let raw: unknown;
  try {
    raw = JSON.parse(designJson);
  } catch {
    return { error: "Couldn't read the design." };
  }
  await saveEventDesign(userId, eventId, parseDesign(raw, userId), makeDefault);
  return { ok: true };
}

export async function resetToDefaultDesign(eventId: string): Promise<{ ok: true }> {
  const userId = await ownerOf(eventId);
  await resetEventDesign(userId, eventId);
  return { ok: true };
}

export async function startPhotoUploads(eventId: string, files: { type: string; size: number }[]) {
  const userId = await ownerOf(eventId);
  try {
    return { uploads: await startManualUploads(userId, eventId, files) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't start the upload." };
  }
}

export async function finishPhotoUploads(eventId: string, sessionIds: string[]) {
  const userId = await ownerOf(eventId);
  return { added: await finishManualUploads(userId, eventId, sessionIds.filter(isUuid)) };
}
