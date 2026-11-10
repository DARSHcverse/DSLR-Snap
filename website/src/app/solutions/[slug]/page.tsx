import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ContentPage, JsonLd } from "@/components/ContentPage";
import { Faq } from "@/components/Faq";
import { Icon } from "@/components/Icon";
import { PricingCards } from "@/components/Pricing";
import { SOLUTIONS } from "@/lib/marketing";
import { site, siteUrl } from "@/lib/site";

export function generateStaticParams() {
  return SOLUTIONS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps<"/solutions/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const s = SOLUTIONS.find((x) => x.slug === slug);
  return s ? pageMetadata({ title: s.title, description: s.description, path: `/solutions/${s.slug}` }) : {};
}

/** Landing pages for what operators search for ("360 photo booth software", …). */
export default async function SolutionPage({ params }: PageProps<"/solutions/[slug]">) {
  const { slug } = await params;
  const s = SOLUTIONS.find((x) => x.slug === slug);
  if (!s) notFound();
  return (
    <ContentPage eyebrow={s.name} title={s.title} intro={s.intro}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: `${site.name}: ${s.name}`,
          description: s.description,
          applicationCategory: "MultimediaApplication",
          operatingSystem: "Windows 10, Windows 11",
          url: `${siteUrl}/solutions/${s.slug}`,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free trial with a watermark, no time limit" },
        }}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {s.points.map((p) => (
          <div key={p.title} className="flex gap-4 rounded-card border border-line bg-surface p-6">
            <Icon name="check" className="mt-1 size-6 shrink-0 text-ok" />
            <div>
              <h2 className="text-lg font-semibold">{p.title}</h2>
              <p className="mt-1.5 leading-relaxed text-muted">{p.body}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-8 rounded-card border border-line bg-surface-2 p-5 text-muted">
        <strong className="text-fg">What you need:</strong> {s.hardware}
      </p>
      <h2 className="mt-16 font-display text-2xl font-bold">How it works</h2>
      <ol className="mt-5 grid gap-3 sm:grid-cols-3">
        {s.steps.map((step, i) => (
          <li key={step} className="rounded-card border border-line bg-surface p-5">
            <p className="text-sm font-semibold text-accent">Step {i + 1}</p>
            <p className="mt-1.5 leading-relaxed">{step}</p>
          </li>
        ))}
      </ol>
      <p className="mt-5 text-muted">
        Step-by-step setup is in the <Link href="/guide" className="text-accent hover:underline">user guide</Link>. Ready to try it?{" "}
        <Link href="/download" className="text-accent hover:underline">Download DSLR Snap free</Link>.
      </p>
      <Faq items={s.faq} />
      <h2 className="mt-20 text-center font-display text-3xl font-bold tracking-[-0.02em]">Every booth type in one plan</h2>
      <PricingCards />
    </ContentPage>
  );
}
