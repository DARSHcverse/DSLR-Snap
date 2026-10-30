import { Code2, Download, KeyRound, Link2, Mail, MessageCircle, MessageSquare, QrCode, RefreshCw, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { Suspense } from "react";
import { ConfirmButton } from "@/components/dash/ConfirmButton";
import { btn, IconChip, Panel, Pill } from "@/components/dash/ui";
import { replaceLink } from "../actions";
import { CopyLink } from "../CopyLink";
import { ownedEvent } from "../data";

export const metadata: Metadata = { title: "Sharing" };

export default function SharingPage({ params }: PageProps<"/account/events/[id]/sharing">) {
  return (
    <Suspense>
      <Sharing params={params} />
    </Suspense>
  );
}

async function Sharing({ params }: Pick<PageProps<"/account/events/[id]/sharing">, "params">) {
  const { id } = await params;
  const { event, link } = await ownedEvent(id);
  const qr = await QRCode.toDataURL(link, { margin: 1, width: 600, color: { dark: "#16161d", light: "#ffffff" } });
  const message = `Here are the photo booth photos from ${event.name}: ${link}`;
  const embed = `<iframe src="${link}" style="width:100%;min-height:900px;border:0" loading="lazy" title="${event.name.replace(/"/g, "")} photos"></iframe>`;
  const share = "inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-line px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-surface-2";

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      <Panel title={<span className="flex items-center gap-2"><QrCode className="size-5 text-accent" aria-hidden /> QR code</span>} description="Print it on a table card or show it on screen.">
        <div className="rounded-2xl bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
          <img src={qr} alt={`QR code for ${event.name}`} className="w-full" />
        </div>
        <a href={qr} download={`${event.name} gallery QR.png`} className={`${btn} mt-4 w-full`}><Download className="size-4" /> Download QR image</a>
      </Panel>

      <div className="flex min-w-0 flex-col gap-6">
        <Panel
          title={<span className="flex items-center gap-2"><Link2 className="size-5 text-accent" aria-hidden /> Gallery link</span>}
          action={<Pill tone={event.linkEnabled ? "ok" : "bad"}>{event.linkEnabled ? "Link on" : "Link off"}</Pill>}
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <input readOnly value={link} aria-label="Gallery link" className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm" />
            <CopyLink url={link} />
          </div>
          {!event.linkEnabled && <p className="mt-2 text-sm text-bad">The link is off, so it won&apos;t open for anyone. Turn Link sharing on above.</p>}
          <p className="mt-5 mb-2 text-sm text-muted">Send it to the client</p>
          <div className="flex flex-wrap gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener" className={share}><MessageCircle className="size-4 text-ok" aria-hidden /> WhatsApp</a>
            <a href={`mailto:?subject=${encodeURIComponent(`Your photos from ${event.name}`)}&body=${encodeURIComponent(message)}`} className={share}><Mail className="size-4 text-[#7cc0fa]" aria-hidden /> Email</a>
            <a href={`sms:?&body=${encodeURIComponent(message)}`} className={share}><MessageSquare className="size-4 text-busy" aria-hidden /> Text message</a>
          </div>
          <form action={replaceLink} className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <input type="hidden" name="event" value={event.id} />
            <p className="text-sm text-muted">Shared it with the wrong person? Make a new link and the old one stops working.</p>
            <ConfirmButton message="Make a new link? The old link and QR code stop working straight away." className={btn}><RefreshCw className="size-4" /> New link</ConfirmButton>
          </form>
        </Panel>

        <Panel title="Who can see what">
          <ul className="grid gap-3 sm:grid-cols-2">
            <li className="flex gap-3 rounded-xl border border-line p-4">
              <IconChip icon={Users} tone="violet" className="size-9" />
              <span className="text-sm"><span className="block font-semibold">{event.guestAccess === "all" ? "Guests see everyone's photos" : "Guests see only their own"}</span><span className="text-muted">From each guest&apos;s QR page</span></span>
            </li>
            <li className="flex gap-3 rounded-xl border border-line p-4">
              <IconChip icon={KeyRound} tone={event.passwordSet ? "green" : "blue"} className="size-9" />
              <span className="text-sm"><span className="block font-semibold">{event.passwordSet ? "Password protected" : "No password"}</span><span className="text-muted">{event.allowDownloadAll ? "Download all is on" : "Download all is off"}</span></span>
            </li>
          </ul>
          <Link href={`/account/events/${event.id}/settings`} className="mt-3 inline-block text-sm font-semibold text-accent hover:underline">Change in Settings</Link>
        </Panel>

        <Panel id="embed" title={<span className="flex items-center gap-2"><Code2 className="size-5 text-accent" aria-hidden /> Embed on your website</span>} description="Paste this code where the gallery should appear on your own site.">
          <pre className="overflow-x-auto rounded-xl border border-line bg-bg p-3.5 text-xs text-fg">{embed}</pre>
          <CopyLink url={embed} label="Copy code" className={`${btn} mt-3`} />
        </Panel>
      </div>
    </div>
  );
}
