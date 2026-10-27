import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { Header } from "./Header";

/** Frame for marketing, support and legal pages: header, a heading block, the content, footer. */
export function ContentPage({ eyebrow, title, intro, children, narrow }: { eyebrow?: string; title: string; intro?: ReactNode; children: ReactNode; narrow?: boolean }) {
  return (
    <>
      <Header />
      <main className="overflow-x-clip">
        <section className="bg-[radial-gradient(120%_60%_at_50%_0%,var(--color-booth-glow)_0%,var(--color-bg)_65%)]">
          <div className={`mx-auto px-4 pt-16 pb-12 sm:px-6 sm:pt-24 ${narrow ? "max-w-3xl" : "max-w-6xl"}`}>
            {eyebrow && <p className="text-sm font-semibold tracking-[0.2em] text-accent uppercase">{eyebrow}</p>}
            <h1 className="mt-3 font-display text-[clamp(34px,5.5vw,60px)] leading-[1.05] font-bold tracking-[-0.03em] text-balance">{title}</h1>
            {intro && <p className="mt-5 max-w-2xl text-lg text-pretty text-muted">{intro}</p>}
          </div>
        </section>
        <div className={`mx-auto px-4 pb-24 sm:px-6 ${narrow ? "max-w-3xl" : "max-w-6xl"}`}>{children}</div>
      </main>
      <Footer />
    </>
  );
}

/** Long-form text (legal, support articles) without a typography plugin. */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4 leading-relaxed text-muted [&_a]:text-accent [&_a]:underline-offset-4 hover:[&_a]:underline [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-fg [&_h3]:mt-6 [&_h3]:font-semibold [&_h3]:text-fg [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-fg">
      {children}
    </div>
  );
}

/** Structured data for search engines (schema.org JSON-LD). */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
