"use client";

import {
  ChevronDown,
  CreditCard,
  Download,
  ExternalLink,
  Globe,
  Images,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  MessageCircle,
  Monitor,
  PenLine,
  Search,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { signOut } from "@/app/(auth)/actions";
import { Logo } from "@/components/Logo";

export interface ChromeUser {
  displayName: string;
  email: string;
  plan: string;
  trial: boolean;
  unread: number;
  /** The public homepage, when it's set up and switched on. */
  homepageUrl: string | null;
}

const NAV = [
  { href: "/account", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/account/events", label: "Events", icon: Images },
  { href: "/account/homepage", label: "Homepage", icon: Globe },
  { href: "/account/billing", label: "Plan & billing", icon: CreditCard },
  { href: "/account/computers", label: "Booth computers", icon: Monitor },
  { href: "/account/settings", label: "Settings", icon: Settings },
] as const;

/** The signed-in frame: sidebar (a drawer on phones), a top bar with search and the account menu. */
export function DashChrome({ user, children }: { user: ChromeUser; children: ReactNode }) {
  const path = usePathname();
  // The phone drawer belongs to the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  const setOpen = (o: boolean) => setOpenOn(o ? path : null);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      <aside className="hidden border-r border-line bg-surface/50 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <Sidebar user={user} path={path} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col border-r border-line bg-surface shadow-2xl">
            <button onClick={() => setOpen(false)} className="absolute top-4 right-3 rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Close menu">
              <X className="size-5" />
            </button>
            <Sidebar user={user} path={path} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur-lg sm:px-6 lg:px-8">
          <button onClick={() => setOpen(true)} className="-ml-2 rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg lg:hidden" aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <Link href="/account" className="lg:hidden" aria-label="Dashboard">
            <Logo />
          </Link>
          <SearchBox />
          <Link href="/account/support" className="relative ml-auto hidden rounded-xl p-2.5 text-muted hover:bg-surface-2 hover:text-fg sm:block" aria-label="Help and chat">
            <MessageCircle className="size-5" />
            {user.unread > 0 && <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full border-2 border-bg bg-accent" />}
          </Link>
          <UserMenu user={user} />
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}

function Sidebar({ user, path }: { user: ChromeUser; path: string }) {
  const on = (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(`${href}/`));
  const item = (active: boolean) =>
    `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${active ? "bg-accent/12 font-semibold text-fg" : "text-muted hover:bg-surface-2 hover:text-fg"}`;
  return (
    <>
      <div className="flex h-16 shrink-0 items-center px-5">
        <Link href="/account" aria-label="Dashboard">
          <Logo />
        </Link>
      </div>
      <nav aria-label="Dashboard" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        {NAV.map(({ href, label, icon: I, ...rest }) => {
          const active = on(href, "exact" in rest);
          return (
            <Link key={href} href={href} className={item(active)} aria-current={active ? "page" : undefined}>
              <I className={`size-[18px] ${active ? "text-accent" : ""}`} aria-hidden />
              {label}
            </Link>
          );
        })}
        <Link href="/account/support" className={item(on("/account/support"))}>
          <LifeBuoy className={`size-[18px] ${on("/account/support") ? "text-accent" : ""}`} aria-hidden />
          Help & chat
          {user.unread > 0 && <span className="ml-auto rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-bold text-accent-ink">{user.unread}</span>}
        </Link>
      </nav>
      <div className="flex flex-col gap-3 border-t border-line p-4">
        {user.trial && (
          <Link href="/account/billing" className="rounded-xl border border-accent/40 bg-gradient-to-br from-accent/20 to-transparent p-3.5 text-sm">
            <span className="flex items-center gap-1.5 font-semibold"><Sparkles className="size-4 text-accent" aria-hidden /> Free trial</span>
            <span className="mt-0.5 block text-xs text-muted">Choose a plan to remove the watermark.</span>
          </Link>
        )}
        <a href="/download" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-fg">
          <Download className="size-4" aria-hidden /> Download DSLR Snap
        </a>
      </div>
    </>
  );
}

function SearchBox() {
  const params = useSearchParams();
  const path = usePathname();
  return (
    <form action="/account/events" role="search" className="relative hidden max-w-sm flex-1 sm:block">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        key={path}
        name="q"
        type="search"
        defaultValue={path === "/account/events" ? (params.get("q") ?? "") : ""}
        placeholder="Search events"
        aria-label="Search events"
        className="w-full rounded-xl border border-line bg-surface py-2 pr-3 pl-9 text-sm placeholder:text-muted/70 focus:border-accent focus:outline-none"
      />
    </form>
  );
}

function UserMenu({ user }: { user: ChromeUser }) {
  const ref = useRef<HTMLDivElement>(null);
  const path = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpenOn(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const row = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-fg/90 hover:bg-surface-2";
  return (
    <div ref={ref} className="relative ml-auto sm:ml-0">
      <button onClick={() => setOpenOn(open ? null : path)} aria-expanded={open} aria-haspopup="menu" className="flex items-center gap-2.5 rounded-xl py-1.5 pr-2 pl-1.5 hover:bg-surface-2">
        <Avatar name={user.displayName} />
        <span className="hidden max-w-40 truncate text-sm font-semibold md:block">{user.displayName}</span>
        <ChevronDown className={`size-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-2xl shadow-black/50">
          <div className="flex items-center gap-3 px-3 py-3">
            <Avatar name={user.displayName} big />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.displayName}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
          </div>
          <hr className="my-1 border-line" />
          {user.homepageUrl && (
            <a href={user.homepageUrl} target="_blank" rel="noopener" className={row}><ExternalLink className="size-4 text-muted" /> View homepage</a>
          )}
          <Link href="/account/homepage" className={row}><PenLine className="size-4 text-muted" /> Edit homepage</Link>
          <hr className="my-1 border-line" />
          <Link href="/account/billing" className={row}><CreditCard className="size-4 text-muted" /> Plan & billing <span className="ml-auto text-xs text-muted">{user.plan}</span></Link>
          <Link href="/account/computers" className={row}><Monitor className="size-4 text-muted" /> Booth computers</Link>
          <Link href="/account/settings" className={row}><Settings className="size-4 text-muted" /> Settings</Link>
          <hr className="my-1 border-line" />
          <Link href="/account/support" className={row}><LifeBuoy className="size-4 text-muted" /> Help & chat</Link>
          <Link href="/account/support?topic=feature" className={row}><Sparkles className="size-4 text-muted" /> Request a feature</Link>
          <Link href="/" className={row}><Globe className="size-4 text-muted" /> dslrsnap.com</Link>
          <hr className="my-1 border-line" />
          <form action={signOut}>
            <button className={`${row} w-full text-left`}><LogOut className="size-4 text-muted" /> Sign out</button>
          </form>
        </div>
      )}
    </div>
  );
}

export function Avatar({ name, big }: { name: string; big?: boolean }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-[#d9467a] font-bold text-white uppercase ${big ? "size-10 text-base" : "size-8 text-sm"}`} aria-hidden>
      {name.trim().charAt(0) || "?"}
    </span>
  );
}
