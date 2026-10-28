import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { safeNext } from "@/lib/appAuth";
import { accountsEnabled } from "@/lib/config";
import { supabaseForRequest } from "@/lib/supabase/server";

const TYPES = new Set<EmailOtpType>(["recovery", "signup", "invite", "magiclink", "email_change", "email"]);

/**
 * Links sent from the admin (password reset for a customer). Unlike /auth/callback these carry a
 * one-time token hash, so they work in the customer's browser, not just the one that asked.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(url.searchParams.get("next"));
  if (accountsEnabled && tokenHash && type && TYPES.has(type)) {
    const { error } = await (await supabaseForRequest()).auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
