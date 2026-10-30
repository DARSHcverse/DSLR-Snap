"use server";

import { redirect } from "next/navigation";
import { createEvent } from "@/lib/cloudEvents";
import { getCurrentUser } from "@/lib/supabase/server";

/** "Create new event": an empty gallery to add photos to by hand. */
export async function newEvent(form: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/events");
  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  const date = String(form.get("date") ?? "");
  if (!name) redirect("/account/events?new=1");
  const id = await createEvent(user.id, name, /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null);
  redirect(`/account/events/${id}?done=${encodeURIComponent("Event created. Add photos to start the gallery.")}`);
}
