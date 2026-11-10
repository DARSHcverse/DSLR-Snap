import { JsonLd } from "./ContentPage";

export type FaqItem = { q: string; a: string };

/** Questions and answers as open/close rows, with FAQPage structured data for search engines. */
export function Faq({ title = "Questions operators ask", items }: { title?: string; items: FaqItem[] }) {
  if (!items.length) return null;
  return (
    <section className="mt-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        }}
      />
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <div className="mt-5 divide-y divide-line rounded-card border border-line bg-surface">
        {items.map((item) => (
          <details key={item.q} className="group px-6 py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
              <h3 className="text-base">{item.q}</h3>
              <span className="text-xl leading-none text-accent transition-transform group-open:rotate-45" aria-hidden>+</span>
            </summary>
            <p className="mt-3 leading-relaxed text-muted">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
