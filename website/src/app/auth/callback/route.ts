import { after, NextResponse } from "next/server";
import { welcomeIfNew } from "@/lib/email/lifecycle";
import { safeNext } from "@/lib/appAuth";
import { accountsEnabled } from "@/lib/config";
import { supabaseForRequest } from "@/lib/supabase/server";

/** Landing point for email confirmation, password reset and Google sign-in links. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  if (accountsEnabled && code) {
    const { data, error } = await (await supabaseForRequest()).auth.exchangeCodeForSession(code);
    if (!error) {
      if (data.user) after(() => welcomeIfNew(data.user)); // once per account, after the redirect is sent
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(new URL(`/login?error=link&next=${encodeURIComponent(next)}`, url.origin));
}
