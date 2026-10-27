import { NextResponse } from "next/server";
import { safeNext } from "@/lib/appAuth";
import { accountsEnabled } from "@/lib/config";
import { supabaseForRequest } from "@/lib/supabase/server";

/** Landing point for email confirmation, password reset and Google sign-in links. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  if (accountsEnabled && code) {
    const { error } = await (await supabaseForRequest()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL(`/login?error=link&next=${encodeURIComponent(next)}`, url.origin));
}
