import Image from "next/image";
import { PrintMock } from "./PrintMock";

// The guest-facing "Tap to start" screen, rebuilt from the app's booth styles.
export function BoothScreen() {
  return (
    <div className="relative mx-auto w-full max-w-[620px]" aria-hidden="true">
      <div className="rounded-[26px] border border-line bg-[#050507] p-2.5 shadow-[0_40px_120px_-20px_rgba(255,122,89,0.25)] sm:p-3">
        <div className="relative aspect-[3/2] overflow-hidden rounded-[18px] bg-bg">
          {/* The event's backdrop photo, dimmed so the start button stands out (as in the app). */}
          <Image src="/photos/friends-gold-backdrop.webp" alt="" fill preload sizes="(min-width: 1024px) 600px, 95vw" className="scale-105 object-cover object-[40%_35%] blur-[2px]" />
          <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_30%,rgba(11,11,15,0.55)_0%,rgba(11,11,15,0.92)_75%)]" />
          <div className="absolute inset-x-0 top-0 bottom-[26%] flex flex-col items-center justify-center gap-[5%] px-6 text-center">
            <p className="text-[clamp(9px,1.3vw,13px)] font-semibold tracking-[0.2em] text-accent uppercase">
              Priya &amp; Tom
            </p>
            <p className="font-display text-[clamp(30px,6vw,64px)] leading-none font-bold tracking-[-0.03em]">
              Tap to start
            </p>
            <span className="rounded-full bg-accent px-[8%] py-[2.5%] text-[clamp(10px,1.6vw,17px)] font-semibold text-accent-ink">
              Take photos
            </span>
          </div>
          <div className="absolute right-[4%] bottom-[5%] left-[4%] flex justify-center gap-[2%] opacity-70">
            {["grid", "single", "grid", "single", "grid"].map((layout, i) => (
              <PrintMock key={i} layout={layout as "grid" | "single"} session={i} caption={false} sizes="60px" className="w-[11%]" />
            ))}
          </div>
        </div>
      </div>
      <PrintMock
        layout="strip"
        session={1}
        sizes="(min-width: 1024px) 120px, 20vw"
        className="absolute -right-2 -bottom-10 w-[22%] rotate-[7deg] sm:-right-8 sm:-bottom-12"
      />
    </div>
  );
}
