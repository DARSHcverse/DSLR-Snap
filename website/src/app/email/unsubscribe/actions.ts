"use server";

import { redirect } from "next/navigation";
import { setUpdatesByToken } from "@/lib/email/preferences";

export async function changeUpdates(form: FormData): Promise<void> {
  const token = String(form.get("t") ?? "");
  const on = form.get("on") === "1";
  const ok = await setUpdatesByToken(token, on);
  redirect(`/email/unsubscribe?t=${encodeURIComponent(token)}&done=${ok ? (on ? "on" : "off") : "invalid"}`);
}
