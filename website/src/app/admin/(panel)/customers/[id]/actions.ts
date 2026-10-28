"use server";

import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { deleteAccount } from "@/lib/account";
import { adminHref, audit, requireAdmin } from "@/lib/admin/server";
import { appUrl } from "@/lib/config";
import { emailAccountDeleted } from "@/lib/email/lifecycle";
import { emailForUser, sendEmail } from "@/lib/email/send";
import { resetPassword } from "@/lib/email/templates";
import { stripe, syncSubscription } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Every action: signed-in admin, a real customer id, and the customer's email for the log. */
async function target(form: FormData): Promise<{ id: string; email: string }> {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) redirect(adminHref("customers"));
  const email = await emailForUser(id);
  if (!email) redirect(adminHref("customers"));
  return { id, email };
}
const back = (id: string, done: string): never => redirect(adminHref(`customers/${id}?done=${encodeURIComponent(done)}`));

/** Emails the customer a reset link that works in their own browser (see /auth/confirm). */
export async function sendResetLink(form: FormData): Promise<void> {
  const t = await target(form);
  const { data, error } = await supabaseAdmin().auth.admin.generateLink({ type: "recovery", email: t.email });
  if (error || !data.properties?.hashed_token) back(t.id, "Couldn't create a reset link.");
  const link = `${appUrl}/auth/confirm?${new URLSearchParams({ token_hash: data.properties!.hashed_token, type: "recovery", next: "/reset?step=new" })}`;
  const sent = await sendEmail({ to: t.email, email: resetPassword(link), template: "admin-reset-link" });
  await audit("password.reset_link", { userId: t.id, email: t.email }, { sent });
  back(t.id, sent ? `Reset link emailed to ${t.email}.` : "Couldn't send the email.");
}

export type TempPasswordResult = { password: string } | { error: string } | null;

/** Sets a temporary password and shows it once, for a customer who can't get the email. */
export async function setTemporaryPassword(_prev: TempPasswordResult, form: FormData): Promise<TempPasswordResult> {
  const t = await target(form);
  const ABC = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const password = Array.from({ length: 3 }, () => Array.from({ length: 4 }, () => ABC[randomInt(ABC.length)]).join("")).join("-");
  const { error } = await supabaseAdmin().auth.admin.updateUserById(t.id, { password });
  if (error) return { error: error.message };
  await audit("password.temporary", { userId: t.id, email: t.email });
  return { password };
}

export async function confirmEmail(form: FormData): Promise<void> {
  const t = await target(form);
  await supabaseAdmin().auth.admin.updateUserById(t.id, { email_confirm: true });
  await audit("email.confirmed_by_admin", { userId: t.id, email: t.email });
  back(t.id, "Email marked as confirmed.");
}

/** Free access: on/off, optional end date, number of booth computers, and why. */
export async function setFreeAccess(form: FormData): Promise<void> {
  const t = await target(form);
  const on = form.get("on") === "1";
  const untilRaw = String(form.get("until") ?? "");
  const until = /^\d{4}-\d{2}-\d{2}$/.test(untilRaw) ? new Date(`${untilRaw}T23:59:59Z`).toISOString() : null;
  const devices = Math.min(50, Math.max(1, Number(form.get("devices")) || 2));
  const note = String(form.get("note") ?? "").trim().slice(0, 300) || null;
  await supabaseAdmin().from("customer_profiles").upsert({ user_id: t.id, comp_active: on, comp_until: on ? until : null, comp_devices: devices, comp_note: note });
  await audit(on ? "comp.on" : "comp.off", { userId: t.id, email: t.email }, { until, devices, note });
  back(t.id, on ? `Free access on${until ? ` until ${untilRaw}` : ""} for ${devices} computers. Booths pick it up next time they check in.` : "Free access turned off.");
}

/** Cancel at period end, cancel now, or undo a scheduled cancellation. */
export async function changeSubscription(form: FormData): Promise<void> {
  const t = await target(form);
  const sub = String(form.get("subscription") ?? "");
  const how = String(form.get("how") ?? "");
  if (!sub.startsWith("sub_")) back(t.id, "No subscription to change.");
  try {
    if (how === "now") await stripe().subscriptions.cancel(sub);
    else await stripe().subscriptions.update(sub, { cancel_at_period_end: how === "end" });
    await syncSubscription(sub);
  } catch (e) {
    back(t.id, `Stripe said: ${e instanceof Error ? e.message : "error"}`);
  }
  await audit(`subscription.${how}`, { userId: t.id, email: t.email }, { subscription: sub });
  back(t.id, how === "now" ? "Subscription cancelled now." : how === "end" ? "Subscription will end at the period end." : "Cancellation undone: the plan renews again.");
}

export async function revokeDevice(form: FormData): Promise<void> {
  const t = await target(form);
  const device = String(form.get("device") ?? "");
  await supabaseAdmin().from("devices").update({ revoked_at: new Date().toISOString(), refresh_token_hash: null }).eq("id", device).eq("user_id", t.id);
  await audit("device.revoked", { userId: t.id, email: t.email }, { device });
  back(t.id, "Computer signed out. It drops to the trial next time it checks in.");
}

export async function saveNote(form: FormData): Promise<void> {
  const t = await target(form);
  const note = String(form.get("note") ?? "").trim().slice(0, 4000) || null;
  await supabaseAdmin().from("customer_profiles").upsert({ user_id: t.id, admin_note: note });
  await audit("note.saved", { userId: t.id, email: t.email });
  back(t.id, "Note saved.");
}

/** Same as the customer's own Delete button; you type their email to confirm. */
export async function deleteCustomer(form: FormData): Promise<void> {
  const t = await target(form);
  if (String(form.get("confirm") ?? "").trim().toLowerCase() !== t.email.toLowerCase()) back(t.id, "Type the customer's email exactly to delete.");
  try {
    await deleteAccount(t.id);
  } catch (e) {
    back(t.id, `Nothing was deleted: ${e instanceof Error ? e.message : "error"}`);
  }
  await audit("account.deleted_by_admin", { userId: t.id, email: t.email });
  after(() => emailAccountDeleted(t.email));
  redirect(adminHref("customers"));
}
