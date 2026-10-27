import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseConfig, supabaseSecretKey } from "../config";

/** Acts as the signed-in visitor (their session cookie). For Server Components, Actions and Route Handlers. */
export async function supabaseForRequest() {
  if (!supabaseConfig) throw new Error("Accounts are not configured.");
  const store = await cookies();
  return createServerClient(supabaseConfig.url, supabaseConfig.publishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) store.set(name, value, options);
        } catch {
          // Server Components can't set cookies; proxy.ts refreshes the session instead.
        }
      },
    },
  });
}

/** Bypasses row-level security. Only call after the code has established who the request is for. */
export function supabaseAdmin() {
  if (!supabaseConfig || !supabaseSecretKey) throw new Error("Accounts are not configured.");
  return createClient(supabaseConfig.url, supabaseSecretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export interface CurrentUser {
  id: string;
  email: string;
}

/** The signed-in user, checked with Supabase (not just read from the cookie), or null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!supabaseConfig) return null;
  const { data } = await (await supabaseForRequest()).auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? "" } : null;
}
