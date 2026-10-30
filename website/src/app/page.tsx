import { BoothScreen } from "@/components/BoothScreen";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Icon, type IconName } from "@/components/Icon";
import { PrintMock } from "@/components/PrintMock";
import { PLANS } from "@/lib/plans";
import { earlyAccessHref, site, siteUrl, tradingName } from "@/lib/site";
import { FAQ, FEATURES } from "@/lib/marketing";
import { PricingCards } from "@/components/Pricing";
import { JsonLd } from "@/components/ContentPage";

const STEPS = [
  { title: "Event", body: "Name, date and the text that goes on the print." },
  { title: "Template", body: "Pick a layout or import your own design." },
  { title: "Camera", body: "Set exposure and flash, take a test shot." },
  { title: "Print & share", body: "Choose print sizes, copies and QR sharing." },
  { title: "Test & launch", body: "Do a full test run, then hand the booth to guests." },
];

const RELIABILITY: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "shield",
    title: "No double prints",
    body: "Every print request is tracked. If the printer runs out of paper, the job waits for you instead of printing twice.",
  },
  {
    icon: "camera",
    title: "Camera hiccups don't crash the booth",
    body: "The camera connection runs separately. If it drops, it restarts on its own and the booth stays on screen.",
  },
  {
    icon: "lock",
    title: "Operator PIN",
    body: "Guests can't reach settings. A PIN protects the operator menu.",
  },
  {
    icon: "sliders",
    title: "Survives a power cut",
    body: "Sessions and the print queue are saved as you go. After a restart you carry on where you left off.",
  },
];

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: site.name,
    description: site.description,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Windows 10, Windows 11",
    url: siteUrl,
    image: `${siteUrl}/opengraph-image`,
    featureList: FEATURES.map((f) => f.title),
    softwareRequirements: "Windows 10 or 11; Canon or Nikon camera; DNP dye-sub printer for prints",
    offers: PLANS.map((p) => ({
      "@type": "Offer",
      name: `${p.name} plan`,
      price: p.id === "yearly" ? "168" : "30",
      priceCurrency: "USD",
      category: "subscription",
    })),
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: tradingName,
    url: siteUrl,
    logo: `${siteUrl}/icon.svg`,
    email: site.supportEmail,
    sameAs: Object.values(site.social).filter(Boolean),
  },
];

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold tracking-[0.2em] text-accent uppercase">{eyebrow}</p>
      <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.02em] text-balance sm:text-5xl">
        {title}
      </h2>
      {body && <p className="mt-4 text-lg text-pretty text-muted">{body}</p>}
    </div>
  );
}

export default function Home() {
  return (
    <>
      <JsonLd data={jsonLd} />
      <Header />
      <main id="top" className="overflow-x-clip">
        {/* Hero */}
        <section className="relative bg-[radial-gradient(120%_70%_at_50%_0%,var(--color-booth-glow)_0%,var(--color-bg)_65%)]">
          <div className="mx-auto grid max-w-6xl items-center gap-16 px-4 pt-16 pb-28 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:pt-24 lg:pb-36">
            <div className="text-center lg:text-left">
              <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-muted">
                <Icon name="windows" className="size-3.5 text-accent" />
                Photo booth software for Windows
              </p>
              <h1 className="mt-6 font-display text-[clamp(40px,7vw,72px)] leading-[1.02] font-bold tracking-[-0.03em] text-balance">
                Turn your DSLR into a <span className="text-accent">photo booth</span> guests line up for.
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-lg text-pretty text-muted lg:mx-0">
                DSLR photo booth, glam B&amp;W, green screen and AI backgrounds, 360 with GoPro and a video
                guestbook, in one app for Surface Pro and Windows touch devices. Prints, GIFs and QR downloads, and it keeps going when the
                venue <span className="whitespace-nowrap">Wi-Fi</span> drops.
              </p>
              <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <a
                  href={earlyAccessHref}
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 font-semibold text-accent-ink transition-transform active:scale-[0.97]"
                >
                  Get early access
                  <Icon name="arrow" className="size-4" />
                </a>
                <a
                  href="#how-it-works"
                  className="rounded-full border border-line bg-surface-2 px-7 py-3.5 font-semibold transition-colors hover:border-muted"
                >
                  See how it works
                </a>
              </div>
              <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted lg:justify-start">
                {["Canon DSLR", "GoPro 360", "DNP printing", "Works offline"].map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <Icon name="check" className="size-4 text-ok" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <BoothScreen />
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <SectionHeading
            eyebrow="Features"
            title="Everything the booth needs, nothing it doesn't"
            body="Built for operators who run real events, where the queue is long and the internet is bad."
          />
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-card border border-line bg-surface p-6">
                <span className="flex size-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Icon name={f.icon} className="size-6" />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Templates */}
        <section className="border-y border-line bg-surface/50">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-24 sm:px-6 lg:grid-cols-2">
            <div className="order-2 flex items-end justify-center gap-4 sm:gap-6 lg:order-1">
              <PrintMock layout="strip" session={0} names="Sofia's 30th" date="8 November 2026" className="w-[22%] -rotate-3" />
              <PrintMock layout="grid" session={1} className="w-[38%]" />
              <PrintMock layout="single" session={2} names="Baby shower" date="13 December 2026" className="w-[30%] rotate-3" />
            </div>
            <div className="order-1 lg:order-2">
              <p className="text-sm font-semibold tracking-[0.2em] text-accent uppercase">Templates</p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.02em] text-balance sm:text-5xl">
                Design in Canva. Print from the booth.
              </h2>
              <p className="mt-4 text-lg text-pretty text-muted">
                Export your design as a PNG with see-through photo windows and drop it in. DSLR Snap finds
                each window automatically. Drag to fine-tune, and the preview matches the print.
              </p>
              <ul className="mt-8 space-y-3">
                {[
                  "2×6 strips and 4×6 portrait or landscape prints",
                  "Built-in layouts with your event name, date and logo",
                  "Print-ready 300 dpi output",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Icon name="check" className="mt-0.5 size-5 shrink-0 text-ok" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <SectionHeading
            eyebrow="How it works"
            title="Set up an event in five steps"
            body="A guided setup gets you from blank to booth-ready, and you can duplicate last week's event to start even faster."
          />
          <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((step, i) => (
              <li key={step.title} className="rounded-card border border-line bg-surface p-6">
                <span className="flex size-9 items-center justify-center rounded-full bg-accent font-display font-bold text-accent-ink">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-6 rounded-card border border-line bg-surface p-6 sm:p-8">
            <p className="text-sm font-semibold tracking-[0.2em] text-muted uppercase">The guest experience</p>
            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-3 text-sm sm:text-base">
              {["Tap to start", "Countdown", "Photo with instant retake", "Print", "Scan QR"].map(
                (stage, i, all) => (
                  <span key={stage} className="flex items-center gap-3">
                    <span className="rounded-full border border-line bg-surface-2 px-4 py-2 font-medium">
                      {stage}
                    </span>
                    {i < all.length - 1 && <Icon name="arrow" className="size-4 text-accent" />}
                  </span>
                ),
              )}
            </div>
          </div>
        </section>

        {/* Hardware */}
        <section id="hardware" className="border-y border-line bg-surface/50">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <SectionHeading
              eyebrow="Hardware"
              title="Built around kit operators already trust"
              body="Use the camera's own lens and flash, not a webcam, with a printer made for events."
            />
            <div className="mt-14 grid gap-4 md:grid-cols-3">
              {[
                {
                  icon: "camera" as const,
                  label: "Camera",
                  name: "Canon or Nikon",
                  note: "Connected through Canon's and Nikon's official SDKs. Nikon Z series in beta; D-series DSLRs next.",
                },
                {
                  icon: "printer" as const,
                  label: "Printer",
                  name: "DNP DS-RX1HS",
                  note: "4×6 prints, plus 2×6 strips cut automatically by the printer.",
                },
                {
                  icon: "windows" as const,
                  label: "Computer",
                  name: "Windows 10 or 11",
                  note: "Surface Pro, Windows tablets, all-in-one touch PCs or a laptop. A Surface Pro fits neatly in most booth shells.",
                },
              ].map((kit) => (
                <div key={kit.label} className="rounded-card border border-line bg-surface p-6">
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <Icon name={kit.icon} className="size-4 text-accent" />
                    {kit.label}
                  </div>
                  <p className="mt-3 font-display text-2xl font-bold tracking-tight">{kit.name}</p>
                  <p className="mt-2 leading-relaxed text-muted">{kit.note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Reliability */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <SectionHeading
            eyebrow="Event-proof"
            title="Made for the night things go wrong"
            body="Paper runs out, cables get kicked and Wi-Fi disappears. DSLR Snap is built to recover so your guests don't notice."
          />
          <div className="mt-14 grid gap-4 sm:grid-cols-2">
            {RELIABILITY.map((r) => (
              <div key={r.title} className="flex gap-5 rounded-card border border-line bg-surface p-6">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-ok/10 text-ok">
                  <Icon name={r.icon} className="size-6" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold">{r.title}</h3>
                  <p className="mt-1.5 leading-relaxed text-muted">{r.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <SectionHeading
            eyebrow="Pricing"
            title="One plan, everything included"
            body="No feature tiers and no per-print fees. Pay monthly or save with a yearly plan."
          />
          <PricingCards />
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-line">
          <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
            <SectionHeading eyebrow="FAQ" title="Questions operators ask" />
            <div className="mt-12 divide-y divide-line rounded-card border border-line bg-surface">
              {FAQ.map((item) => (
                <details key={item.q} className="group px-6 py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span className="text-xl leading-none text-accent transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 leading-relaxed text-muted">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 pb-24 sm:px-6">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-[28px] border border-line bg-[radial-gradient(100%_120%_at_50%_0%,var(--color-booth-glow)_0%,var(--color-surface)_70%)] px-6 py-16 text-center sm:py-20">
            <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold tracking-[-0.02em] text-balance sm:text-5xl">
              Get your booth ready for the next event
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-pretty text-muted">
              DSLR Snap is in early access for photo booth operators. Tell us about your setup and
              we&apos;ll get you started.
            </p>
            <a
              href={earlyAccessHref}
              className="mt-9 inline-flex items-center gap-2 rounded-full bg-accent px-8 py-4 text-lg font-semibold text-accent-ink transition-transform active:scale-[0.97]"
            >
              Get early access
              <Icon name="arrow" className="size-5" />
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
