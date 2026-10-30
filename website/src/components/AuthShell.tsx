import { Images, Monitor, QrCode } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./Logo";
import { PrintMock } from "./PrintMock";

/**
 * Sign in, sign up and password reset: the form on a card, beside a wall of photo booth prints.
 * Phones get just the card over a soft glow.
 */
export function AuthShell({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <main className="relative flex min-h-dvh flex-col bg-[radial-gradient(90%_50%_at_50%_0%,var(--color-booth-glow)_0%,var(--color-bg)_70%)] px-4 py-6 sm:px-10">
        <Link href="/" aria-label="DSLR Snap home" className="self-start">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-10">
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em] text-balance">{title}</h1>
          {intro && <p className="mt-2 text-pretty text-muted">{intro}</p>}
          <div className="mt-8">{children}</div>
        </div>
        <p className="text-center text-xs text-muted">
          <Link href="/privacy" className="hover:text-fg">Privacy</Link> · <Link href="/terms" className="hover:text-fg">Terms</Link> · <Link href="/support" className="hover:text-fg">Help</Link>
        </p>
      </main>

      <aside className="relative hidden overflow-hidden border-l border-line bg-[#120f17] lg:block" aria-hidden>
        {/* A tilted wall of prints, drifting gently. */}
        <div className="absolute inset-[-20%] flex rotate-[-8deg] gap-6 opacity-90">
          {[0, 1, 2, 3].map((col) => (
            <div key={col} className={`flex w-1/4 flex-col gap-6 ${col % 2 ? "auth-drift-down mt-[-30%]" : "auth-drift-up"}`}>
              {[0, 1, 2].map((row) => (
                <PrintMock
                  key={row}
                  layout={(["strip", "grid", "single", "hero"] as const)[(col + row) % 4]}
                  names={["Priya & Tom", "Sam turns 30", "Ava & Leo", "Office party"][(col * 3 + row) % 4]}
                  date={["24 October 2026", "8 November 2026", "13 December 2026"][row]}
                  className="w-full"
                />
              ))}
            </div>
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0f] via-[#0b0b0f]/40 to-[#0b0b0f]/10" />
        <div className="absolute inset-x-0 bottom-0 p-12">
          <p className="max-w-md font-display text-3xl leading-tight font-bold text-balance">Every event, every guest, every photo in one place.</p>
          <ul className="mt-6 flex flex-col gap-3 text-sm text-fg/85">
            {[
              { icon: Images, text: "Galleries upload from the booth as guests take photos" },
              { icon: QrCode, text: "Share with a link or QR code, with a password if you like" },
              { icon: Monitor, text: "Manage your booth computers, plan and invoices" },
            ].map(({ icon: I, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-accent/15 text-accent"><I className="size-4" /></span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
