import "server-only";
import { supabaseAdmin } from "../supabase/server";

const TOKEN = /^[0-9a-f]{32}$/;

/** Sets update emails on or off for the account behind an unsubscribe token. False if the token is unknown. */
export async function setUpdatesByToken(token: unknown, on: boolean): Promise<boolean> {
  if (typeof token !== "string" || !TOKEN.test(token)) return false;
  const { data } = await supabaseAdmin()
    .from("customer_profiles")
    .update({ updates_opt_out_at: on ? null : new Date().toISOString() })
    .eq("unsubscribe_token", token)
    .select("user_id");
  return !!data?.length;
}

export async function updatesOn(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin().from("customer_profiles").select("updates_opt_out_at").eq("user_id", userId).maybeSingle();
  return !data?.updates_opt_out_at;
}

export async function setUpdatesForUser(userId: string, on: boolean): Promise<void> {
  await supabaseAdmin().from("customer_profiles").upsert({ user_id: userId, updates_opt_out_at: on ? null : new Date().toISOString() });
}
