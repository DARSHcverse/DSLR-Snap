import type { Metadata } from "next";
import QRCode from "qrcode";
import type { CSSProperties } from "react";
import { Suspense } from "react";
import { GalleryNotice, GalleryShell } from "@/components/gallery/GalleryShell";
import { designForEvent } from "@/lib/cloudDesign";
import { appUrl, accountsEnabled } from "@/lib/config";
import { designVars } from "@/lib/design";
import { isShareToken } from "@/lib/gallery";
import { publicEventByToken } from "@/lib/galleryServer";
import { hasAccess } from "../access";
import { Unlock } from "../Unlock";
import { Slideshow } from "./Slideshow";

export const metadata: Metadata = { title: "Slideshow", robots: { index: false, follow: false } };

/** A full-screen slideshow of the event for a TV or projector at the venue. */
export default function SlideshowPage({ params }: PageProps<"/e/[token]/slideshow">) {
  return (
    <Suspense fallback={null}>
      <Show params={params} />
    </Suspense>
  );
}

async function Show({ params }: Pick<PageProps<"/e/[token]/slideshow">, "params">) {
  const { token } = await params;
  const event = accountsEnabled && isShareToken(token) ? await publicEventByToken(token) : null;
  if (!event || !event.linkEnabled) return <GalleryShell><GalleryNotice title="Slideshow not available" body="This gallery's link is off, or the link is wrong." /></GalleryShell>;
  const look = await designForEvent(event.userId, event.design);
  if (!(await hasAccess(event))) {
    return (
      <GalleryShell look={look}>
        <div className="py-12 text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight">{event.name}</h1>
          <p className="mt-2 text-muted">Enter the gallery password to start the slideshow.</p>
          <Unlock token={token} next="slideshow" />
        </div>
      </GalleryShell>
    );
  }
  const galleryUrl = `${appUrl}/e/${token}`;
  const qr = await QRCode.toDataURL(galleryUrl, { margin: 1, width: 320, color: { dark: "#111111", light: "#ffffff" } });
  return (
    <div style={designVars(look.design) as CSSProperties} className="text-fg">
      <Slideshow token={token} eventName={event.name} qr={qr} galleryUrl={`/e/${token}`} />
    </div>
  );
}
