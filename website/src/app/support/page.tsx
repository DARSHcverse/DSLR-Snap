import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import { ContentPage, JsonLd } from "@/components/ContentPage";
import { FAQ } from "@/lib/marketing";
import { site } from "@/lib/site";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = pageMetadata({
  title: "Support",
  description:
    "DSLR Snap help: getting started, cameras, printers, 360 with GoPro, green screen, licences and contact.",
  path: "/support",
});

const GUIDES: { title: string; steps: string[] }[] = [
  {
    title: "Getting started",
    steps: [
      "Install DSLR Snap on your Windows 10 or 11 booth computer (Surface Pro, tablet, touch PC or laptop) and open it.",
      "Choose where photos are saved (Home asks the first time). Each event gets its own folder with Photos, Prints, GIFs and Videos.",
      "Plug in the camera and printer. They're found automatically: Home shows a green tick for each.",
      "Create an event: name, booth type, template, look, camera exposure, print and QR settings. Then Start booth.",
    ],
  },
  {
    title: "Camera and printer",
    steps: [
      "Canon cameras: set the dial to M, JPEG only, auto power off disabled; close Canon EOS Utility (it blocks the camera).",
      "DNP printers: install DNP's Windows driver; DSLR Snap finds the printer whatever Windows named it.",
      "Press New roll under Printer & devices when you load media, and the booth counts down the prints left.",
    ],
  },
  {
    title: "360 booth with a GoPro",
    steps: [
      "Use a GoPro HERO9–12 with a memory card, updated firmware and charging.",
      "Plug it in by USB and switch it on; it's found within a few seconds. If not, set the GoPro's USB connection to GoPro Connect (not MTP).",
      "Start spins from the screen, the phone remote or a foot pedal (Printer & devices → Foot pedal).",
    ],
  },
  {
    title: "Your licence",
    steps: [
      "Sign in under Account in the app; your browser opens, you approve, and the app is licensed.",
      "Each plan covers 2 computers; remove one or add more at dslrsnap.com/account.",
      "The booth works offline for 14 days between licence checks, so venue Wi-Fi never stops an event.",
    ],
  },
];

export default function SupportPage() {
  return (
    <ContentPage eyebrow="Support" title="How can we help?" intro="Quick guides for the questions operators ask most, and a direct line to us.">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        }}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {GUIDES.map((g) => (
          <section key={g.title} className="rounded-card border border-line bg-surface p-6">
            <h2 className="text-lg font-semibold">{g.title}</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 leading-relaxed text-muted">
              {g.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </section>
        ))}
      </div>

      <h2 className="mt-16 font-display text-3xl font-bold tracking-[-0.02em]">Common questions</h2>
      <div className="mt-6 divide-y divide-line rounded-card border border-line bg-surface">
        {FAQ.map((item) => (
          <details key={item.q} className="group px-6 py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
              {item.q}
              <span className="text-xl leading-none text-accent transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 leading-relaxed text-muted">{item.a}</p>
          </details>
        ))}
      </div>

      <section id="contact" className="mt-16 grid gap-10 md:grid-cols-[1fr_1.4fr]">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-[-0.02em]">Contact us</h2>
          <p className="mt-3 text-muted">
            Questions before buying, help at an event, or billing. Or email{" "}
            <a href={`mailto:${site.supportEmail}`} className="text-accent hover:underline">{site.supportEmail}</a>.
          </p>
          <p className="mt-3 text-muted">
            Already a customer? <Link href="/account/support" className="text-accent hover:underline">Chat with us from your account</Link> and keep the whole conversation in one place.
          </p>
          <p className="mt-3 text-sm text-muted">Tip: in the app, Printer &amp; devices → App shows your version and the log file. Attaching the log helps us fix things fast.</p>
        </div>
        <ContactForm />
      </section>
    </ContentPage>
  );
}
