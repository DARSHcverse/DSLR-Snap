import "server-only";
import { adminHref } from "./admin/server";
import { sendEmail, TEAM_EMAIL } from "./email/send";
import { supportReply, teamNotice } from "./email/templates";
import { productionUrl } from "./site";
import { supabaseAdmin } from "./supabase/server";

/**
 * Support chat. Customers write from their account (or a visitor through the contact form); the
 * team answers in the admin. Each new message emails the other side, so nobody has to keep a tab open.
 */

export interface Thread {
  id: string;
  user_id: string | null;
  email: string;
  name: string | null;
  subject: string;
  status: "open" | "closed";
  unread_by_admin: boolean;
  unread_by_customer: boolean;
  last_message_at: string;
  created_at: string;
}
export interface Message {
  id: number;
  from_admin: boolean;
  body: string;
  created_at: string;
}

const MAX_PER_HOUR = 20;
const clean = (s: string, max: number) => s.replace(/\r\n/g, "\n").trim().slice(0, max);

async function notifyTeam(thread: Thread, body: string, isNew: boolean) {
  await sendEmail({
    to: TEAM_EMAIL,
    replyTo: thread.email,
    email: teamNotice({
      title: isNew ? `New message: ${thread.subject}` : `Reply from ${thread.email}`,
      facts: [["From", thread.name ? `${thread.name} (${thread.email})` : thread.email], ["Subject", thread.subject]],
      message: body,
      link: { label: "Answer in the admin", url: `${productionUrl}${adminHref(`support/${thread.id}`)}` },
    }),
    template: "team-support",
  });
}

/** Too many messages from one customer in the last hour (spam guard). */
async function overLimit(userId: string): Promise<boolean> {
  const db = supabaseAdmin();
  const { data: threads } = await db.from("support_threads").select("id").eq("user_id", userId);
  const ids = (threads ?? []).map((t) => t.id);
  if (!ids.length) return false;
  const { count } = await db
    .from("support_messages")
    .select("id", { count: "exact", head: true })
    .in("thread_id", ids)
    .eq("from_admin", false)
    .gt("created_at", new Date(Date.now() - 3_600_000).toISOString());
  return (count ?? 0) >= MAX_PER_HOUR;
}

export async function startThread(o: { userId: string | null; email: string; name?: string | null; subject: string; body: string }): Promise<Thread> {
  if (o.userId && (await overLimit(o.userId))) throw new Error("You've sent a lot of messages this hour. We'll reply soon.");
  const db = supabaseAdmin();
  if (!o.userId) {
    // Contact form: at most 3 new conversations an hour from one address.
    const { count } = await db
      .from("support_threads")
      .select("id", { count: "exact", head: true })
      .eq("email", o.email.toLowerCase())
      .gt("created_at", new Date(Date.now() - 3_600_000).toISOString());
    if ((count ?? 0) >= 3) throw new Error("Too many messages from this address. We'll reply soon.");
  }
  const { data: thread, error } = await db
    .from("support_threads")
    .insert({ user_id: o.userId, email: o.email.toLowerCase(), name: o.name ?? null, subject: clean(o.subject, 120) || "Question", unread_by_admin: true })
    .select("*")
    .single<Thread>();
  if (error || !thread) throw new Error("Couldn't start the conversation.");
  const body = clean(o.body, 4000);
  await db.from("support_messages").insert({ thread_id: thread.id, from_admin: false, body });
  await notifyTeam(thread, body, true);
  return thread;
}

/** A customer's own threads, newest first. */
export async function threadsForUser(userId: string): Promise<Thread[]> {
  const { data } = await supabaseAdmin().from("support_threads").select("*").eq("user_id", userId).order("last_message_at", { ascending: false });
  return (data ?? []) as Thread[];
}

async function messages(threadId: string): Promise<Message[]> {
  const { data } = await supabaseAdmin().from("support_messages").select("id, from_admin, body, created_at").eq("thread_id", threadId).order("created_at");
  return (data ?? []) as Message[];
}

/** One of the customer's threads (never someone else's); marks the team's replies as read. */
export async function threadForUser(userId: string, id: string): Promise<{ thread: Thread; messages: Message[] } | null> {
  const db = supabaseAdmin();
  const { data: thread } = await db.from("support_threads").select("*").eq("id", id).eq("user_id", userId).maybeSingle<Thread>();
  if (!thread) return null;
  if (thread.unread_by_customer) await db.from("support_threads").update({ unread_by_customer: false }).eq("id", id);
  return { thread, messages: await messages(id) };
}

export async function customerReply(userId: string, id: string, text: string): Promise<void> {
  const db = supabaseAdmin();
  const { data: thread } = await db.from("support_threads").select("*").eq("id", id).eq("user_id", userId).maybeSingle<Thread>();
  if (!thread) throw new Error("Conversation not found.");
  if (await overLimit(userId)) throw new Error("You've sent a lot of messages this hour. We'll reply soon.");
  const body = clean(text, 4000);
  if (!body) return;
  await db.from("support_messages").insert({ thread_id: id, from_admin: false, body });
  await db.from("support_threads").update({ status: "open", unread_by_admin: true, last_message_at: new Date().toISOString() }).eq("id", id);
  await notifyTeam(thread, body, false);
}

// ---------- Admin side ----------

export async function inbox(status: "open" | "closed"): Promise<Thread[]> {
  const { data } = await supabaseAdmin().from("support_threads").select("*").eq("status", status).order("last_message_at", { ascending: false }).limit(200);
  return (data ?? []) as Thread[];
}

export async function unreadCount(): Promise<number> {
  const { count } = await supabaseAdmin().from("support_threads").select("id", { count: "exact", head: true }).eq("unread_by_admin", true);
  return count ?? 0;
}

export async function threadForAdmin(id: string): Promise<{ thread: Thread; messages: Message[] } | null> {
  const db = supabaseAdmin();
  const { data: thread } = await db.from("support_threads").select("*").eq("id", id).maybeSingle<Thread>();
  if (!thread) return null;
  if (thread.unread_by_admin) await db.from("support_threads").update({ unread_by_admin: false }).eq("id", id);
  return { thread, messages: await messages(id) };
}

/** The team's answer: saved, then emailed (customers get a link to the chat; visitors just reply). */
export async function adminReply(id: string, text: string): Promise<void> {
  const db = supabaseAdmin();
  const { data: thread } = await db.from("support_threads").select("*").eq("id", id).maybeSingle<Thread>();
  if (!thread) throw new Error("Conversation not found.");
  const body = clean(text, 4000);
  if (!body) return;
  await db.from("support_messages").insert({ thread_id: id, from_admin: true, body });
  await db.from("support_threads").update({ unread_by_customer: true, unread_by_admin: false, last_message_at: new Date().toISOString() }).eq("id", id);
  await sendEmail({
    to: thread.email,
    email: supportReply({ reply: body, url: thread.user_id ? `${productionUrl}/account/support?t=${id}` : null }),
    template: "support-reply",
  });
}

export async function setThreadStatus(id: string, status: "open" | "closed"): Promise<void> {
  await supabaseAdmin().from("support_threads").update({ status }).eq("id", id);
}
