import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { ContentPage } from "@/components/ContentPage";
import { Faq } from "@/components/Faq";
import { Icon } from "@/components/Icon";
import { COMPARISON } from "@/lib/marketing";

export const metadata: Metadata = pageMetadata({
  title: "dslrBooth Alternative: DSLR Snap vs LumaBooth",
  description:
    "Looking for a dslrBooth alternative? Compare DSLR Snap with dslrBooth (now LumaBooth for Windows): prices, computers included, cloud gallery and free trial.",
  path: "/compare/dslrbooth",
});

const SWITCH_STEPS = [
  "Download DSLR Snap and try it free alongside your current software. There's no time limit.",
  "Export your print designs as PNGs with see-through photo windows and import them. DSLR Snap finds the windows for you.",
  "Plug in your Canon or Nikon camera and DNP printer. Home shows a green tick for each, then run a test event.",
];

const FAQ = [
  { q: "Is DSLR Snap a good dslrBooth alternative?", a: "If you run your booth on Windows with a Canon or Nikon camera and a DNP printer, DSLR Snap covers the same jobs: photo booth, prints, GIFs and boomerangs, green screen, 360 with a GoPro, video guestbook and QR sharing, for less per month. Try it free with no time limit to compare at your own events." },
  { q: "Is dslrBooth the same as LumaBooth?", a: "Yes. dslrBooth was renamed LumaBooth for Windows. This comparison uses the prices on their public pricing page." },
  { q: "Can I use my existing template designs?", a: "Yes, if you have them as images. Export each design as a PNG with see-through photo windows, made in Canva or any design tool, and import it. DSLR Snap finds the windows, and you can drag them to adjust." },
  { q: "Will my camera and printer work?", a: "DSLR Snap supports Canon DSLR and mirrorless cameras, Nikon Z cameras (in beta), and DNP dye-sub printers such as the DS-RX1HS for 4×6 prints and 2×6 strips." },
];

export default function CompareDslrBooth() {
  return (
    <ContentPage
      eyebrow="Compare"
      title="DSLR Snap vs dslrBooth"
      intro="dslrBooth (now LumaBooth for Windows) is a well-known booth app. Here's how the plans compare, using the prices on their public pricing page."
      narrow
    >
      <h2 className="font-display text-2xl font-bold">Price and plan comparison</h2>
      <div className="mt-5 overflow-x-auto rounded-card border border-line">
        <table className="w-full text-left">
          <thead className="bg-surface-2 text-sm">
            <tr>
              <th className="p-4 font-semibold" />
              <th className="p-4 font-semibold">dslrBooth</th>
              <th className="p-4 font-semibold text-accent">DSLR Snap</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {COMPARISON.rows.map((r) => (
              <tr key={r.label}>
                <th className="p-4 font-medium">{r.label}</th>
                <td className="p-4 text-muted">{r.them}</td>
                <td className="p-4">{r.us}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="mt-12 font-display text-2xl font-bold">Also in DSLR Snap</h2>
      <ul className="mt-4 space-y-2.5">
        {COMPARISON.extras.map((e) => (
          <li key={e} className="flex items-start gap-2.5">
            <Icon name="check" className="mt-0.5 size-5 shrink-0 text-ok" />
            {e}
          </li>
        ))}
      </ul>
      <h2 className="mt-12 font-display text-2xl font-bold">Switching from dslrBooth</h2>
      <ol className="mt-4 space-y-3">
        {SWITCH_STEPS.map((step, i) => (
          <li key={step} className="flex gap-3 rounded-card border border-line bg-surface p-5">
            <span className="font-semibold text-accent">{i + 1}.</span>
            {step}
          </li>
        ))}
      </ol>
      <p className="mt-5 text-muted">
        <Link href="/download" className="text-accent hover:underline">Download DSLR Snap free</Link> or{" "}
        <Link href="/pricing" className="text-accent hover:underline">see pricing</Link>.
      </p>
      <Faq title="Questions about switching" items={FAQ} />
      <p className="mt-10 text-sm text-muted">
        dslrBooth and LumaBooth are trademarks of their owner; DSLR Snap is not affiliated with them. Their prices were checked on their public pricing
        page in {COMPARISON.checked} and may have changed since.
      </p>
    </ContentPage>
  );
}
