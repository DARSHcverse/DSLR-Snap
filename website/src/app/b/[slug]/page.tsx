import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { Suspense } from "react";
import { GalleryShell } from "@/components/gallery/GalleryShell";
import { accountsEnabled } from "@/lib/config";
import { designVars } from "@/lib/design";
import { publicHomepage, type PublicHomepage } from "@/lib/homepage";

export async function generateMetadata({ params }: PageProps<"/b/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = accountsEnabled ? await publicHomepage(slug) : null;
  // The page streams, so an unknown address is sent as 200 with Next's not-found UI and a
  // noindex tag (see Next's loading.md): search engines skip it.
  if (!page) notFound();
  return {
    title: { absolute: `${page.name} · Photo booth galleries` },
    description: page.tagline || `Photo booth galleries from ${page.name}.`,
    alternates: { canonical: `/b/${page.slug}` },
  };
}

/** An operator's public homepage: their brand, links and the events they chose to show. */
export default function HomepagePage({ params, searchParams }: PageProps<"/b/[slug]">) {
  return (
    <Suspense fallback={null}>
      <Homepage params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const day = (d: string | null) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null);

function Body({ page }: { page: PublicHomepage }) {
  return (
    <>
      <header className="text-center">
        <h1 className="font-display text-4xl font-bold tracking-[-0.02em] text-balance sm:text-5xl">{page.name}</h1>
        {page.tagline && <p className="mx-auto mt-3 max-w-xl text-lg text-muted">{page.tagline}</p>}
        {(page.bookUrl || page.links.length > 0) && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {page.bookUrl && <a href={page.bookUrl} target="_blank" rel="noopener" className="rounded-full bg-accent px-6 py-2.5 font-semibold text-accent-ink">Book now</a>}
            {page.links.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noopener" className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold hover:bg-surface-2">{l.label}</a>
            ))}
          </div>
        )}
      </header>
      {page.events.length ? (
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {page.events.map((e) => (
            <li key={e.url}>
              <Link href={e.url} target="_top" className="group block overflow-hidden rounded-card border border-line bg-surface transition-colors hover:border-accent">
                <div className="aspect-[4/3] bg-surface-2">
                  {e.cover && (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage URL
                    <img src={e.cover} alt="" loading="lazy" className="size-full object-cover transition-transform group-hover:scale-[1.02]" />
                  )}
                </div>
                <div className="p-4">
                  <p className="truncate font-display font-semibold">{e.name}</p>
                  <p className="mt-1 text-sm text-muted">{[day(e.date), `${e.count} photo${e.count === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-12 text-center text-muted">Galleries will appear here soon.</p>
      )}
    </>
  );
}

async function Homepage({ params, searchParams }: PageProps<"/b/[slug]">) {
  const { slug } = await params;
  const page = accountsEnabled ? await publicHomepage(slug) : null;
  if (!page) notFound();
  if ((await searchParams).embed === "1") {
    // Inside the operator's own website: no outer frame, just the page in their colours.
    return (
      <div style={designVars(page.look.design) as CSSProperties} className="min-h-dvh bg-[var(--color-bg)] p-4 text-fg sm:p-6">
        <Body page={page} />
      </div>
    );
  }
  return (
    <GalleryShell look={page.look}>
      <Body page={page} />
    </GalleryShell>
  );
}
