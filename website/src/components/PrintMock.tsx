// CSS-drawn print layouts that mirror the app's built-in templates.
// Swap for real event photos once the Canon R100 has been run end to end.
// Sizes use container units (cqw) so a print scales with its own width wherever it's placed.

const SHOTS = [
  "from-[#4cc3b9] to-[#1f2a3a]",
  "from-[#f0c164] to-[#2b2433]",
  "from-[#6a4c93] to-[#221d33]",
  "from-[#10c08f] to-[#183039]",
];

function Shot({ tone, className = "" }: { tone: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${tone} ${className}`}>
      {/* soft figure suggests a guest without pretending to be a real photo */}
      <div className="absolute bottom-0 left-1/2 h-[58%] w-[46%] -translate-x-1/2 rounded-t-full bg-white/18" />
      <div className="absolute bottom-[50%] left-1/2 aspect-square w-[28%] -translate-x-1/2 rounded-full bg-white/22" />
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
  className = "",
}: {
  layout: Layout;
  names?: string;
  date?: string;
  caption?: boolean;
  className?: string;
}) {
  // A strip is narrow, so its caption needs a bigger share of the width to stay readable.
  const nameSize = layout === "strip" ? "text-[10cqw]" : "text-[6.5cqw]";
  const dateSize = layout === "strip" ? "text-[6cqw]" : "text-[3.6cqw]";

  let body;
  if (layout === "strip") {
    body = (
      <div className="flex flex-col gap-[5cqw]">
        {SHOTS.slice(0, 3).map((tone) => (
          <Shot key={tone} tone={tone} className="aspect-[7/6]" />
        ))}
      </div>
    );
  } else if (layout === "grid") {
    body = (
      <div className="grid grid-cols-2 gap-[2.5cqw]">
        {SHOTS.map((tone) => (
          <Shot key={tone} tone={tone} className="aspect-[4/5]" />
        ))}
      </div>
    );
  } else if (layout === "hero") {
    body = (
      <div className="grid grid-cols-[2fr_1fr] grid-rows-2 gap-[1.8cqw]">
        <Shot tone={SHOTS[0]} className="row-span-2 aspect-[7/6]" />
        <Shot tone={SHOTS[1]} />
        <Shot tone={SHOTS[2]} />
      </div>
    );
  } else {
    body = <Shot tone={SHOTS[2]} className="aspect-[4/5]" />;
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
