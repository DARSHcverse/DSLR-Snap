"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

// Supabase keeps the session in "sb-<project>-auth-token" (split into .0, .1 … when large). The
// marketing pages are static, so the header checks for that cookie here rather than on the server.
const SESSION_COOKIE = /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/;
const subscribe = () => () => {};
const signedIn = () => SESSION_COOKIE.test(document.cookie);

/** "Sign in · Start free" for visitors, "Your account" once signed in. */
export function AccountLinks() {
  const known = useSyncExternalStore(subscribe, signedIn, () => false);
  if (known) {
    return (
      <Link href="/account" className="rounded-full border border-line px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors hover:bg-surface-2">
        Your account
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Link href="/login" className="rounded-[10px] px-3.5 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg">
        Sign in
      </Link>
      <Link
        href="/signup"
        className="hidden rounded-full bg-accent px-4 py-2 sm:inline-flex text-sm font-semibold text-accent-ink transition-transform active:scale-[0.97]"
      >
        Start free
      </Link>
    </div>
  );
}
