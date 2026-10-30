"use client";

import { BarChart3, CheckCircle2, Images, Palette, Settings2, Share2, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

const TABS = [
  { path: "", label: "Photos", icon: Images },
  { path: "/sharing", label: "Sharing", icon: Share2 },
  { path: "/design", label: "Design", icon: Palette },
  { path: "/analytics", label: "Analytics", icon: BarChart3 },
  { path: "/settings", label: "Settings", icon: Settings2 },
];

/** The event's sections, as tabs under its summary cards. */
export function EventTabs({ eventId }: { eventId: string }) {
  const path = usePathname();
  const base = `/account/events/${eventId}`;
  return (
    <nav aria-label="Event sections" className="-mx-4 flex overflow-x-auto overflow-y-hidden border-b border-line px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      {TABS.map(({ path: p, label, icon: I }) => {
        const on = path === base + p;
        return (
          <Link
            key={label}
            href={base + p}
            aria-current={on ? "page" : undefined}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm whitespace-nowrap transition-colors ${on ? "border-accent font-semibold text-fg" : "border-transparent text-muted hover:text-fg"}`}
          >
            <I className={`size-4 ${on ? "text-accent" : ""}`} aria-hidden /> {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** The "?done=" message an action leaves behind, dismissible. */
export function DoneNotice() {
  const done = useSearchParams().get("done");
  const [closed, setClosed] = useState<string | null>(null);
  if (!done || closed === done) return null;
  return (
    <div role="status" className="flex items-center gap-3 rounded-xl border border-ok/40 bg-ok/10 px-4 py-3 text-sm">
      <CheckCircle2 className="size-4 shrink-0 text-ok" aria-hidden />
      <span className="flex-1">{done}</span>
      <button onClick={() => setClosed(done)} className="rounded p-1 text-muted hover:text-fg" aria-label="Dismiss"><X className="size-4" /></button>
    </div>
  );
}
