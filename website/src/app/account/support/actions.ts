"use server";

import { redirect } from "next/navigation";
import type { ReplyResult } from "@/components/chat/ReplyBox";
import { customerReply, startThread } from "@/lib/support";
import { getCurrentUser } from "@/lib/supabase/server";

async function signedIn() {
  const user = await getCurrentUser();
  if (!user?.email) redirect("/login?next=/account/support");
  return user as typeof user & { email: string };
}

export async function newConversation(_prev: ReplyResult, form: FormData): Promise<ReplyResult> {
  const user = await signedIn();
  const subject = String(form.get("subject") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  if (body.length < 2) return { error: "Write a few words first." };
  let id: string;
  try {
    id = (await startThread({ userId: user.id, email: user.email, subject: subject || body.slice(0, 60), body })).id;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't send." };
  }
  redirect(`/account/support?t=${id}`);
}

export async function sendReply(_prev: ReplyResult, form: FormData): Promise<ReplyResult> {
  const user = await signedIn();
  try {
    await customerReply(user.id, String(form.get("thread") ?? ""), String(form.get("body") ?? ""));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't send." };
  }
  return { ok: Date.now() };
}
