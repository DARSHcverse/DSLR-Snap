import Image from "next/image";
import { sessionFrame } from "@/lib/samplePhotos";

// Print layouts that mirror the app's built-in templates, filled with sample guest photos.
// Sizes use container units (cqw) so a print scales with its own width wherever it's placed.

function Shot({ session, frame, className = "", sizes }: { session: number; frame: number; className?: string; sizes: string }) {
  const p = sessionFrame(session, frame);
  return (
    <div className={`relative overflow-hidden bg-[#2a2420] ${className}`}>
      <Image src={p.src} alt="" fill sizes={sizes} className="object-cover" style={{ objectPosition: p.focus, transform: `scale(${p.zoom})`, transformOrigin: p.focus }} />
    </div>
  );
}

type Layout = "strip" | "grid" | "hero" | "single";

const SHAPE: Record<Layout, string> = {
  strip: "aspect-[1/3] bg-white p-[8cqw] pb-0",
  grid: "aspect-[2/3] bg-[#f6f3ee] p-[5cqw] pb-0",
  hero: "aspect-[3/2] bg-white p-[3.5cqw] pb-0",
  single: "aspect-[2/3] bg-white p-[6cqw] pb-0",
};

export function PrintMock({
  layout,
  names = "Priya & Tom",
  date = "24 October 2026",
  caption = true,
  session = 0,
  sizes = "(min-width: 1024px) 220px, 30vw",
  className = "",
}: {
  layout: Layout;
  names?: string;
  date?: string;
  caption?: boolean;
  /** Which sample guests appear (see SAMPLE_SESSIONS); vary it so neighbouring prints differ. */
  session?: number;
  /** How wide one photo is drawn, for the image optimiser. */
  sizes?: string;
  className?: string;
}) {
  // A strip is narrow, so its caption needs a bigger share of the width to stay readable.
  const nameSize = layout === "strip" ? "text-[10cqw]" : "text-[6.5cqw]";
  const dateSize = layout === "strip" ? "text-[6cqw]" : "text-[3.6cqw]";
  const shot = (frame: number, className: string) => <Shot key={frame} session={session} frame={frame} className={className} sizes={sizes} />;

  let body;
  if (layout === "strip") {
    body = <div className="flex flex-col gap-[5cqw]">{[0, 1, 2].map((i) => shot(i, "aspect-[7/6]"))}</div>;
  } else if (layout === "grid") {
    body = <div className="grid grid-cols-2 gap-[2.5cqw]">{[0, 1, 2, 3].map((i) => shot(i, "aspect-[4/5]"))}</div>;
  } else if (layout === "hero") {
    body = (
      <div className="grid grid-cols-[2fr_1fr] grid-rows-2 gap-[1.8cqw]">
        {shot(0, "row-span-2 aspect-[7/6]")}
        {shot(1, "")}
        {shot(2, "")}
      </div>
    );
  } else {
    body = shot(0, "aspect-[4/5]");
  }

  return (
    <div className={`@container ${className}`}>
      <div className={`shadow-2xl shadow-black/60 ${SHAPE[layout]} ${caption ? "" : "pb-[5cqw]!"}`}>
        {body}
        {caption && (
          <div className="pt-[6cqw] text-center whitespace-nowrap text-[#2a2420]">
            <p className={`font-serif leading-tight font-bold ${nameSize}`}>{names}</p>
            <p className={`mt-[1cqw] text-[#7a716a] ${dateSize}`}>{date}</p>
          </div>
        )}
      </div>
    </div>
  );
}
