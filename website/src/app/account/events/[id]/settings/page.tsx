import { CalendarDays, Globe, KeyRound, ToggleRight, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { btnDanger, btnPrimary, field, IconChip, input, Panel } from "@/components/dash/ui";
import { Switch } from "@/components/dash/Switch";
import { deleteWholeEvent, saveEventSettings } from "../actions";
import { ownedEvent } from "../data";

export const metadata: Metadata = { title: "Event settings" };

export default function EventSettingsPage({ params }: PageProps<"/account/events/[id]/settings">) {
  return (
    <Suspense>
      <EventSettings params={params} />
    </Suspense>
  );
}

async function EventSettings({ params }: Pick<PageProps<"/account/events/[id]/settings">, "params">) {
  const { id } = await params;
  const { event } = await ownedEvent(id);
  const heading = (icon: typeof Globe, text: string, tone?: "violet" | "blue" | "green") => (
    <span className="flex items-center gap-3"><IconChip icon={icon} tone={tone} className="size-9" /> {text}</span>
  );

  return (
    <div className="grid max-w-4xl gap-6">
      <form action={saveEventSettings} className="grid gap-6">
        <input type="hidden" name="event" value={event.id} />
        <Panel title={heading(CalendarDays, "Event details")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={field}>Event name<input name="name" defaultValue={event.name} maxLength={120} className={input} /></label>
            <label className={field}>Event date<input type="date" name="date" defaultValue={event.date ?? ""} className={input} /></label>
          </div>
          <div className="mt-2 divide-y divide-line">
            <Switch name="showDate" label="Show the date" hint="On the gallery page" on={event.showDate} />
          </div>
        </Panel>

        <Panel title={heading(ToggleRight, "Who can see it", "violet")}>
          <div className="-mt-2 divide-y divide-line">
            <Switch name="linkEnabled" label="Link sharing" hint="Anyone with the link can open this gallery" on={event.linkEnabled} />
            <Switch name="guestAccess" label="Guests see everyone's photos" hint="A guest's QR page links to the whole event" on={event.guestAccess === "all"} />
            <Switch name="allowDownloadAll" label="Download all" hint="Visitors can download the whole event as a zip" on={event.allowDownloadAll} />
          </div>
        </Panel>

        <Panel title={heading(KeyRound, "Password", "green")} description={event.passwordSet ? "A password is set. Type a new one to change it." : "Leave empty and anyone with the link can see the gallery."}>
          <div className="flex flex-col gap-3">
            <input name="password" type="text" autoComplete="off" placeholder={event.passwordSet ? "New password" : "No password"} aria-label="Password" className={`${input} max-w-sm`} />
            {event.passwordSet && (
              <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" name="removePassword" value="1" className="accent-[var(--color-accent)]" /> Remove the password</label>
            )}
          </div>
        </Panel>

        <Panel title={heading(Globe, "Your website", "blue")} description="Guests see a link back to you on the gallery.">
          <input name="website" defaultValue={event.website ?? ""} placeholder="yourbooth.co.uk" aria-label="Your website" className={`${input} max-w-sm`} />
        </Panel>

        <div className="sticky bottom-4 z-10 flex justify-end">
          <button className={`${btnPrimary} px-6 py-2.5 shadow-xl shadow-black/40`}>Save settings</button>
        </div>
      </form>

      <section id="delete" className="rounded-2xl border border-bad/30 bg-bad/[0.03] p-5 sm:p-6">
        <h2 className="flex items-center gap-3 font-semibold text-bad"><IconChip icon={TriangleAlert} tone="rose" className="size-9" /> Delete this event</h2>
        <p className="mt-3 text-sm text-muted">Removes every photo and video of this event from DSLR Snap Cloud, and all its links stop working. The copies on your booth computer stay.</p>
        <form action={deleteWholeEvent} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="event" value={event.id} />
          <label className={field}>
            Type <span className="font-semibold text-fg">{event.name}</span> to confirm
            <input name="confirm" autoComplete="off" required className={`${input} w-72 max-w-full`} />
          </label>
          <button className={btnDanger}>Delete event</button>
        </form>
      </section>
    </div>
  );
}
