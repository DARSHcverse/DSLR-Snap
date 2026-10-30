"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getEvent } from "@/lib/cloudEvents";
import { isUuid } from "@/lib/gallery";
import { saveHomepage, setShowOnHomepage } from "@/lib/homepage";
import { getCurrentUser } from "@/lib/supabase/server";

async function signedIn() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/homepage");
  return user.id;
}

export async function saveHomepageSettings(form: FormData): Promise<void> {
  const userId = await signedIn();
  const links = [0, 1, 2, 3, 4].map((i) => ({ label: String(form.get(`label${i}`) ?? ""), url: String(form.get(`url${i}`) ?? "") }));
  const r = await saveHomepage(userId, {
    enabled: form.get("enabled") === "on",
    slug: String(form.get("slug") ?? ""),
    name: String(form.get("name") ?? ""),
    tagline: String(form.get("tagline") ?? ""),
    bookUrl: String(form.get("bookUrl") ?? ""),
    links,
  });
  revalidatePath("/account", "layout");
  redirect(`/account/homepage?done=${encodeURIComponent(r.error ?? "Saved.")}`);
}

export async function toggleOnHomepage(form: FormData): Promise<void> {
  const userId = await signedIn();
  const id = String(form.get("event") ?? "");
  if (isUuid(id) && (await getEvent(userId, id))) await setShowOnHomepage(userId, id, form.get("on") === "1");
  redirect("/account/homepage#events");
}
