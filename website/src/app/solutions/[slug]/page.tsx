import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage, JsonLd } from "@/components/ContentPage";
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
  return s ? { title: s.title, description: s.description, alternates: { canonical: `/solutions/${s.slug}` } } : {};
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
      <h2 className="mt-20 text-center font-display text-3xl font-bold tracking-[-0.02em]">Every booth type in one plan</h2>
      <PricingCards />
    </ContentPage>
  );
}
