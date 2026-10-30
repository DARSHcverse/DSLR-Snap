"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

// Supabase keeps the session in "sb-<project>-auth-token" (split into .0, .1 … when large). The
// marketing pages are static, so the header checks for that cookie here rather than on the server.
const SESSION_COOKIE = /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/;
const subscribe = () => () => {};
const signedIn = () => SESSION_COOKIE.test(document.cookie);

/** "Sign in · Start free" for visitors, "Dashboard" once signed in. */
export function AccountLinks() {
  const known = useSyncExternalStore(subscribe, signedIn, () => false);
  if (known) {
    return (
      <Link href="/account" className="rounded-full border border-line px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors hover:bg-surface-2">
        Dashboard
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

/**
 * Floating "Chat with us" for signed-in customers. Rendered from the footer, not the header: the
 * header's backdrop blur would make "fixed" position relative to the header instead of the screen.
 */
export function ChatButton() {
  const known = useSyncExternalStore(subscribe, signedIn, () => false);
  const path = usePathname();
  if (!known || path.startsWith("/account/support")) return null;
  return (
    <Link
      href="/account/support"
      className="fixed right-4 bottom-4 z-40 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-accent-ink shadow-xl shadow-black/40 transition-transform active:scale-[0.97] sm:right-6 sm:bottom-6"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-none stroke-current stroke-2"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" strokeLinejoin="round" /></svg>
      Chat with us
    </Link>
  );
}
