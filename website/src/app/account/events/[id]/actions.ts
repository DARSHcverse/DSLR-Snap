"use server";

import { redirect } from "next/navigation";
import { deleteEvent, deleteSessions, getEvent, newShareLink, saveSettings, setCover, setHidden } from "@/lib/cloudEvents";
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
const back = (id: string, done: string): never => redirect(`/account/events/${id}?done=${encodeURIComponent(done)}`);

export async function saveEventSettings(form: FormData): Promise<void> {
  const { userId, id } = await owned(form);
  const date = String(form.get("date") ?? "");
  const websiteRaw = String(form.get("website") ?? "");
  const website = cleanWebsite(websiteRaw);
  if (websiteRaw.trim() && !website) back(id, "That website address doesn't look right. Use something like yourbooth.co.uk.");
  const password = form.get("removePassword") === "1" ? "" : String(form.get("password") ?? "").trim() || undefined;
  if (password && password.length < 4) back(id, "Use at least 4 characters for the password.");
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
  back(id, "Saved.");
}

export async function replaceLink(form: FormData): Promise<void> {
  const { userId, id } = await owned(form);
  await newShareLink(userId, id);
  back(id, "New link made. The old one no longer works.");
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
  back(id, { hide: `${ids.length} hidden from the gallery.`, show: `${ids.length} shown again.`, cover: "Cover photo set.", delete: `${ids.length} deleted.` }[op] ?? "Done.");
}

export async function deleteWholeEvent(form: FormData): Promise<void> {
  const { userId, id } = await owned(form);
  const event = await getEvent(userId, id);
  if (String(form.get("confirm") ?? "").trim().toLowerCase() !== event!.name.trim().toLowerCase()) back(id, "Type the event name exactly to delete it.");
  await deleteEvent(userId, id);
  redirect("/account/events");
}
