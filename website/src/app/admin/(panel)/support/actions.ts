"use server";

import { redirect } from "next/navigation";
import type { ReplyResult } from "@/components/chat/ReplyBox";
import { adminHref, audit, requireAdmin } from "@/lib/admin/server";
import { adminReply, setThreadStatus } from "@/lib/support";

const UUID = /^[0-9a-f-]{36}$/;

export async function replyAsAdmin(_prev: ReplyResult, form: FormData): Promise<ReplyResult> {
  await requireAdmin();
  const id = String(form.get("thread") ?? "");
  if (!UUID.test(id)) return { error: "Unknown conversation." };
  try {
    await adminReply(id, String(form.get("body") ?? ""));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't send." };
  }
  await audit("support.replied", {}, { thread: id });
  return { ok: Date.now() };
}

export async function changeStatus(form: FormData): Promise<void> {
  await requireAdmin();
  const id = String(form.get("thread") ?? "");
  const asked = String(form.get("status"));
  const status = asked === "closed" || asked === "spam" ? asked : "open";
  if (UUID.test(id)) await setThreadStatus(id, status);
  redirect(adminHref(status === "open" ? `support/${id}` : status === "spam" ? "support?show=spam" : "support"));
}
