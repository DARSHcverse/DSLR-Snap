import { Code2, ExternalLink, Eye, Globe, ImageOff, Link2, Palette, Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Switch } from "@/components/dash/Switch";
import { btn, btnPrimary, field, IconChip, input, Notice, PageHeader, Panel, Pill } from "@/components/dash/ui";
import { CopyLink } from "../events/[id]/CopyLink";
import { listEvents } from "@/lib/cloudEvents";
import { appUrl } from "@/lib/config";
import { requireDashboardUser } from "@/lib/dashboard";
import { homepageSettings } from "@/lib/homepage";
import { supabaseAdmin } from "@/lib/supabase/server";
import { saveHomepageSettings, toggleOnHomepage } from "./actions";

export const metadata: Metadata = { title: "Homepage" };

export default function HomepageSettingsPage({ searchParams }: PageProps<"/account/homepage">) {
  return (
    <Suspense>
      <Settings searchParams={searchParams} />
    </Suspense>
  );
}

async function Settings({ searchParams }: Pick<PageProps<"/account/homepage">, "searchParams">) {
  const user = await requireDashboardUser("/account/homepage");
  const { done } = await searchParams;
  const [s, events, { data: shown }] = await Promise.all([
    homepageSettings(user.id),
    listEvents(user.id),
    supabaseAdmin().from("gallery_events").select("id, show_on_homepage").eq("user_id", user.id),
  ]);
  const on = new Set((shown ?? []).filter((e) => e.show_on_homepage).map((e) => e.id));
  const url = s.slug ? `${appUrl}/b/${s.slug}` : null;
  const embed = url ? `<iframe src="${url}?embed=1" style="width:100%;min-height:900px;border:0" loading="lazy" title="Photo booth galleries"></iframe>` : "";
  const heading = (icon: typeof Globe, text: string, tone?: "violet" | "blue" | "green") => (
    <span className="flex items-center gap-3"><IconChip icon={icon} tone={tone} className="size-9" /> {text}</span>
  );

  return (
    <>
      <PageHeader
        title="Your homepage"
        intro="A public page for your business with your links, a Book now button and the galleries you choose to show. Put it on your website or in your Instagram bio."
        actions={url && s.enabled ? <a href={url} target="_blank" rel="noopener" className={btn}><ExternalLink className="size-4" /> View homepage</a> : undefined}
      />
      {typeof done === "string" && <Notice tone={done === "Saved." ? "ok" : "bad"}>{done}</Notice>}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex min-w-0 flex-col gap-6">
          <form action={saveHomepageSettings} className="flex flex-col gap-6">
            <Panel title={heading(Store, "Business")} action={<Pill tone={s.enabled ? "ok" : "muted"}>{s.enabled ? "Public" : "Hidden"}</Pill>}>
              <div className="-mt-2 mb-3 divide-y divide-line border-b border-line">
                <Switch name="enabled" label="Homepage is public" hint="Turn off to hide the page without losing your settings" on={s.enabled} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={field}>Business name<input name="name" defaultValue={s.name} maxLength={80} required placeholder="Photo Booth Hire Swansea" className={input} /></label>
                <label className={field}>
                  Address
                  <span className="flex items-center rounded-xl border border-line bg-bg pl-3.5 focus-within:border-accent">
                    <span className="shrink-0 text-muted">dslrsnap.com/b/</span>
                    <input name="slug" defaultValue={s.slug ?? ""} maxLength={40} placeholder="your-business" className="w-full min-w-0 bg-transparent py-2.5 pr-3 text-fg outline-none" />
                  </span>
                </label>
              </div>
              <label className={`${field} mt-4`}>Tagline<input name="tagline" defaultValue={s.tagline} maxLength={160} placeholder="Photo booths, 360 booths and glam booths across South Wales" className={input} /></label>
              <label className={`${field} mt-4`}>Booking link (the Book now button)<input name="bookUrl" defaultValue={s.bookUrl ?? ""} placeholder="yourbooth.co.uk/book" className={input} /></label>
            </Panel>

            <Panel title={heading(Link2, "Links", "violet")} description="Up to 5: your website, Instagram, reviews…">
              <div className="flex flex-col gap-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2">
                    <input name={`label${i}`} defaultValue={s.links[i]?.label ?? ""} placeholder="Label" maxLength={40} aria-label={`Link ${i + 1} label`} className={input} />
                    <input name={`url${i}`} defaultValue={s.links[i]?.url ?? ""} placeholder="instagram.com/yourbooth" aria-label={`Link ${i + 1} address`} className={input} />
                  </div>
                ))}
              </div>
            </Panel>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
              <p className="flex items-center gap-2 text-sm text-muted">
                <Palette className="size-4 shrink-0" aria-hidden /> Uses your default look. Set it from any event&apos;s Design tab with &quot;Use as my default look&quot;.
              </p>
              <button className={btnPrimary}>Save homepage</button>
            </div>
          </form>

          <Panel id="events" title={heading(Eye, "Events on your homepage", "green")} description="Only events you switch on appear, and never ones with a password or the link turned off. Ask your clients first.">
            {events.length ? (
              <ul className="flex flex-col gap-2">
                {events.map((e) => {
                  const listed = on.has(e.id);
                  const blocked = !e.linkEnabled || e.passwordSet;
                  return (
                    <li key={e.id} className="flex items-center gap-3 rounded-xl border border-line p-2.5 pr-3">
                      <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                        {e.cover ? (
                          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage URL
                          <img src={e.cover} alt="" className="size-full object-cover" />
                        ) : (
                          <ImageOff className="m-3 size-6 text-muted" aria-hidden />
                        )}
                      </div>
                      <Link href={`/account/events/${e.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-accent">{e.name}</Link>
                      {blocked ? (
                        <span className="shrink-0 text-xs text-muted">{e.passwordSet ? "Has a password" : "Link off"}</span>
                      ) : (
                        <form action={toggleOnHomepage}>
                          <input type="hidden" name="event" value={e.id} />
                          <input type="hidden" name="on" value={listed ? "0" : "1"} />
                          <button role="switch" aria-checked={listed} aria-label={`Show ${e.name}`} className={`relative h-6 w-11 rounded-full transition-colors ${listed ? "bg-accent" : "bg-surface-2 ring-1 ring-line"}`}>
                            <span className={`absolute top-1 size-4 rounded-full bg-white shadow transition-all ${listed ? "left-6" : "left-1"}`} />
                          </button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted">No events yet.</p>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-6 xl:sticky xl:top-24">
          <Panel title={heading(Eye, "Preview", "blue")}>
            {url && s.enabled ? (
              <div className="overflow-hidden rounded-xl border border-line bg-bg">
                <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
                  {[0, 1, 2].map((i) => <span key={i} className="size-2.5 rounded-full bg-surface-2" />)}
                  <span className="ml-2 truncate text-xs text-muted">{url.replace(/^https?:\/\//, "")}</span>
                </div>
                {/* Shown at 50%: the real page, so it matches what visitors see. */}
                <div className="h-[520px] overflow-hidden">
                  <iframe src={`${url}?embed=1`} title="Homepage preview" className="h-[1040px] w-[200%] origin-top-left scale-50 border-0" loading="lazy" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center rounded-xl border border-dashed border-line px-6 py-12 text-center text-sm text-muted">
                <Globe className="size-8 opacity-60" aria-hidden />
                <p className="mt-3">{url ? "Turn on “Homepage is public” and save to see it here." : "Choose a business name and address, then save."}</p>
              </div>
            )}
          </Panel>

          {url && (
            <Panel title={heading(Code2, "Share and embed", "violet")}>
              <div className="flex gap-2">
                <input readOnly value={url} aria-label="Homepage address" className={`${input} min-w-0 flex-1 text-sm`} />
                <CopyLink url={url} label="Copy" />
              </div>
              <p className="mt-4 text-sm text-muted">To put it on your website, paste this where it should appear:</p>
              <pre className="mt-2 overflow-x-auto rounded-xl border border-line bg-bg p-3 text-xs text-fg">{embed}</pre>
              <CopyLink url={embed} label="Copy code" className={`${btn} mt-3`} />
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
