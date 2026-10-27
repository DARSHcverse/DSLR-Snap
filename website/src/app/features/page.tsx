import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/ContentPage";
import { Icon } from "@/components/Icon";
import { FEATURES, SOLUTIONS } from "@/lib/marketing";

export const metadata: Metadata = {
  title: "Features",
  description: "Everything DSLR Snap does: DSLR photo booth, prints, glam B&W, green screen and AI backgrounds, 360 with GoPro, video guestbook, boomerangs, QR sharing and an offline-first design.",
  alternates: { canonical: "/features" },
};

export default function FeaturesPage() {
  return (
    <ContentPage eyebrow="Features" title="One app for every booth you run" intro="Photo booth, glam booth, green screen, 360 and video guestbook, with the reliability a paid event needs.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-card border border-line bg-surface p-6">
            <span className="flex size-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Icon name={f.icon} className="size-6" />
            </span>
            <h2 className="mt-5 text-lg font-semibold">{f.title}</h2>
            <p className="mt-2 leading-relaxed text-muted">{f.body}</p>
          </div>
        ))}
      </div>
      <h2 className="mt-20 font-display text-3xl font-bold tracking-[-0.02em]">Built for the booth you run</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {SOLUTIONS.map((s) => (
          <Link key={s.slug} href={`/solutions/${s.slug}`} className="group rounded-card border border-line bg-surface p-6 transition-colors hover:border-accent">
            <h3 className="text-lg font-semibold">{s.title}</h3>
            <p className="mt-2 text-muted">{s.intro}</p>
            <p className="mt-4 inline-flex items-center gap-1.5 font-semibold text-accent">
              Learn more <Icon name="arrow" className="size-4" />
            </p>
          </Link>
        ))}
      </div>
    </ContentPage>
  );
}
