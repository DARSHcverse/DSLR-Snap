"use server";

import { redirect } from "next/navigation";
import { adminHref, audit, requireAdmin } from "@/lib/admin/server";
import { announceUpdate } from "@/lib/email/broadcast";

export async function sendAnnouncement(form: FormData): Promise<void> {
  await requireAdmin();
  const version = String(form.get("version") ?? "").trim();
  const highlights = String(form.get("highlights") ?? "").split("\n").map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean).slice(0, 8);
  const testOnly = form.get("mode") !== "all";
  const back = (msg: string): never => redirect(adminHref(`emails?done=${encodeURIComponent(msg)}`));
  if (!/^\d+\.\d+\.\d+$/.test(version) || !highlights.length) back("Add a version like 1.2.0 and at least one highlight.");
  let result: { sent: number; skipped: number };
  try {
    result = await announceUpdate({ version, highlights, testOnly });
  } catch (e) {
    back(`Not sent: ${e instanceof Error ? e.message : "error"}`);
  }
  if (!testOnly) await audit("email.update_announced", {}, { version, sent: result!.sent, skipped: result!.skipped });
  back(testOnly ? "Test sent to support@." : `Sent to ${result!.sent} customers (${result!.skipped} skipped: unsubscribed or already sent).`);
}
