"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAlbum, deleteAlbum, deleteEvent, deleteSessions, getEvent, moveToAlbum, newShareLink, renameAlbum, saveSettings, setCover, setHidden, setLinkEnabled } from "@/lib/cloudEvents";
import { cleanWebsite, isUuid } from "@/lib/gallery";
import { getCurrentUser } from "@/lib/supabase/server";

/** The signed-in operator and an event of theirs; anything else goes back to the list. */
async function owned(form: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/events");
  const id = String(form.get("event") ?? "");
  if (!isUuid(id) || !(await getEvent(user.id, id))) redirect("/account/events");
  return { userId: user.id, id };
}
/** Back to the event page the form was on (photos by default), with a message. */
const PAGES = ["settings", "sharing", "design", "analytics"];
// The event's summary cards live in its layout, which navigation keeps; refresh it with the page.
const back = (id: string, done: string, page = ""): never => {
  revalidatePath(`/account/events/${id}`, "layout");
  return redirect(`/account/events/${id}${PAGES.includes(page) ? `/${page}` : ""}?done=${encodeURIComponent(done)}`);
};

export async function saveEventSettings(form: FormData): Promise<void> {
  const { userId, id } = await owned(form);
  const date = String(form.get("date") ?? "");
  const websiteRaw = String(form.get("website") ?? "");
  const website = cleanWebsite(websiteRaw);
  if (websiteRaw.trim() && !website) back(id, "That website address doesn't look right. Use something like yourbooth.co.uk.", "settings");
  const password = form.get("removePassword") === "1" ? "" : String(form.get("password") ?? "").trim() || undefined;
  if (password && password.length < 4) back(id, "Use at least 4 characters for the password.", "settings");
  await saveSettings(userId, id, {
    name: String(form.get("name") ?? ""),
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    showDate: form.get("showDate") === "on",
    linkEnabled: form.get("linkEnabled") === "on",
    guestAccess: form.get("guestAccess") === "on" ? "all" : "own",
    allowDownloadAll: form.get("allowDownloadAll") === "on",
    website,
    password,
  });
  back(id, "Saved.", "settings");
}

/** The Link sharing switch on the event's summary cards. */
export async function toggleLinkSharing(form: FormData): Promise<void> {
  const { userId, id } = await owned(form);
  const on = form.get("on") === "1";
  await setLinkEnabled(userId, id, on);
  back(id, on ? "Link sharing is on. Anyone with the link can see the gallery." : "Link sharing is off. The gallery link no longer opens.", String(form.get("from") ?? ""));
}

export async function replaceLink(form: FormData): Promise<void> {
  const { userId, id } = await owned(form);
  await newShareLink(userId, id);
  back(id, "New link made. The old one no longer works.", "sharing");
}

/** Toolbar actions on selected sessions: hide, show, delete, or make one the cover. */
export async function sessionAction(form: FormData): Promise<void> {
  const { userId, id } = await owned(form);
  const ids = form.getAll("session").map(String).filter(isUuid);
  const op = String(form.get("op") ?? "");
  if (!ids.length) back(id, "Select some photos first.");
  if (op === "hide") await setHidden(userId, id, ids, true);
  else if (op === "show") await setHidden(userId, id, ids, false);
  else if (op === "cover") await setCover(userId, id, ids[0]);
  else if (op === "delete") await deleteSessions(userId, id, ids);
  else if (op === "move") {
    const album = String(form.get("album") ?? "");
    await moveToAlbum(userId, id, ids, isUuid(album) ? album : null);
  }
  back(id, { hide: `${ids.length} hidden from the gallery.`, show: `${ids.length} shown again.`, cover: "Cover photo set.", delete: `${ids.length} deleted.`, move: `${ids.length} moved.` }[op] ?? "Done.");
}

export async function deleteWholeEvent(form: FormData): Promise<void> {
  const { userId, id } = await owned(form);
  const event = await getEvent(userId, id);
  if (String(form.get("confirm") ?? "").trim().toLowerCase() !== event!.name.trim().toLowerCase()) back(id, "Type the event name exactly to delete it.", "settings");
  await deleteEvent(userId, id);
  redirect("/account/events");
}

export async function addAlbum(form: FormData): Promise<void> {
  const { userId, id } = await owned(form);
  try {
    await createAlbum(userId, id, String(form.get("name") ?? ""));
  } catch (e) {
    back(id, e instanceof Error ? e.message : "Couldn't add the album.");
  }
  back(id, "Album added. Select photos, then Move to album.");
}

export async function changeAlbum(form: FormData): Promise<void> {
  const { userId, id } = await owned(form);
  const album = String(form.get("album") ?? "");
  if (!isUuid(album)) back(id, "Album not found.");
  if (form.get("op") === "delete") {
    await deleteAlbum(userId, album);
    revalidatePath(`/account/events/${id}`, "layout");
    redirect(`/account/events/${id}?done=${encodeURIComponent("Album deleted. Its photos are still in the event.")}`);
  }
  await renameAlbum(userId, album, String(form.get("name") ?? ""));
  revalidatePath(`/account/events/${id}`, "layout");
  redirect(`/account/events/${id}?album=${album}&done=${encodeURIComponent("Album renamed.")}`);
}
