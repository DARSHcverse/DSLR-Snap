import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Card, NotReady, PageShell } from "@/components/PageShell";
import { inputClass } from "@/components/ui";
import { listEvents } from "@/lib/cloudEvents";
import { accountsEnabled, appUrl } from "@/lib/config";
import { homepageSettings } from "@/lib/homepage";
import { getCurrentUser, supabaseAdmin } from "@/lib/supabase/server";
import { saveHomepageSettings, toggleOnHomepage } from "./actions";

export const metadata: Metadata = { title: "Your homepage", robots: { index: false } };

export default function HomepageSettingsPage({ searchParams }: PageProps<"/account/homepage">) {
  return (
    <PageShell title="Your homepage" intro="A public page for your business with your logo, links, a Book now button and the galleries you choose to show. Put it on your website or in your Instagram bio." wide>
      {accountsEnabled ? (
        <Suspense fallback={<p className="text-muted">Loading…</p>}>
          <Settings searchParams={searchParams} />
        </Suspense>
      ) : (
        <NotReady />
      )}
    </PageShell>
  );
}

async function Settings({ searchParams }: Pick<PageProps<"/account/homepage">, "searchParams">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/homepage");
  const { done } = await searchParams;
  const [s, events, { data: shown }] = await Promise.all([
    homepageSettings(user.id),
    listEvents(user.id),
    supabaseAdmin().from("gallery_events").select("id, show_on_homepage").eq("user_id", user.id),
  ]);
  const on = new Set((shown ?? []).filter((e) => e.show_on_homepage).map((e) => e.id));
  const url = s.slug ? `${appUrl}/b/${s.slug}` : null;
  const field = "flex flex-col gap-1 text-sm text-muted";

  return (
    <div className="flex flex-col gap-6">
      {typeof done === "string" && <p className={`rounded-xl border px-4 py-3 text-sm ${done === "Saved." ? "border-ok/40 bg-ok/10" : "border-bad/40 bg-bad/10"}`}>{done}</p>}
      <Card>
        <form action={saveHomepageSettings} className="flex flex-col gap-4">
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" name="enabled" defaultChecked={s.enabled} className="size-4 accent-[var(--color-accent)]" /> Homepage is public
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={field}>Business name<input name="name" defaultValue={s.name} maxLength={80} required placeholder="Photo Booth Hire Swansea" className={inputClass} /></label>
            <label className={field}>
              Address
              <span className="flex items-center gap-1 rounded-xl border border-line bg-bg pl-3">
                <span className="text-muted">dslrsnap.com/b/</span>
                <input name="slug" defaultValue={s.slug ?? ""} maxLength={40} placeholder="your-business" className="w-full bg-transparent py-3 pr-3 text-fg outline-none" />
              </span>
            </label>
          </div>
          <label className={field}>Tagline<input name="tagline" defaultValue={s.tagline} maxLength={160} placeholder="Photo booths, 360 booths and glam booths across South Wales" className={inputClass} /></label>
          <label className={field}>Booking link (the Book now button)<input name="bookUrl" defaultValue={s.bookUrl ?? ""} placeholder="yourbooth.co.uk/book" className={inputClass} /></label>
          <div>
            <p className="text-sm text-muted">Links (up to 5: website, Instagram, reviews…)</p>
            <div className="mt-2 flex flex-col gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="grid grid-cols-[1fr_2fr] gap-2">
                  <input name={`label${i}`} defaultValue={s.links[i]?.label ?? ""} placeholder="Label" maxLength={40} className={inputClass} />
                  <input name={`url${i}`} defaultValue={s.links[i]?.url ?? ""} placeholder="instagram.com/yourbooth" className={inputClass} />
                </div>
              ))}
            </div>
          </div>
          <p className="text-sm text-muted">
            The page uses your default look (colours, font, logo). Set it from any event&apos;s <strong>Edit design</strong> with &quot;Use as my default look&quot;.
          </p>
          <button className="self-start rounded-full bg-accent px-6 py-2.5 font-semibold text-accent-ink">Save</button>
        </form>
      </Card>

      {url && (
        <Card>
          <h2 className="font-semibold">Share and embed</h2>
          <p className="mt-2 text-sm">
            {s.enabled ? <a href={url} target="_blank" rel="noopener" className="text-accent hover:underline">{url} ↗</a> : <span className="text-muted">{url} (turn the homepage on to make it public)</span>}
          </p>
          <p className="mt-4 text-sm text-muted">Add it to your website by pasting this where it should appear:</p>
          <pre className="mt-2 overflow-x-auto rounded-xl border border-line bg-bg p-3 text-xs text-fg">{`<iframe src="${url}?embed=1" style="width:100%;min-height:900px;border:0" loading="lazy" title="Photo booth galleries"></iframe>`}</pre>
        </Card>
      )}

      <Card>
        <h2 id="events" className="font-semibold">Events on your homepage</h2>
        <p className="mt-1 text-sm text-muted">Only events you switch on appear, and never ones with a password or the link turned off. Ask your clients first.</p>
        {events.length ? (
          <ul className="mt-3 divide-y divide-line/60">
            {events.map((e) => {
              const listed = on.has(e.id);
              const blocked = !e.linkEnabled || e.passwordSet;
              return (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <Link href={`/account/events/${e.id}`} className="truncate hover:text-accent">{e.name}</Link>
                  {blocked ? (
                    <span className="shrink-0 text-xs text-muted">{e.passwordSet ? "Has a password" : "Link off"}</span>
                  ) : (
                    <form action={toggleOnHomepage}>
                      <input type="hidden" name="event" value={e.id} />
                      <input type="hidden" name="on" value={listed ? "0" : "1"} />
                      <button className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${listed ? "border-ok/50 text-ok" : "border-line text-muted hover:text-fg"}`}>{listed ? "✓ Shown" : "Show"}</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">No events yet.</p>
        )}
      </Card>
    </div>
  );
}
