import { Bell, Building2, KeyRound, LogOut, Mail, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { signOut } from "@/app/(auth)/actions";
import { ResetForm } from "@/app/(auth)/reset/ResetForm";
import { Avatar } from "@/components/dash/DashChrome";
import { btn, btnDanger, btnPrimary, field, IconChip, input, Notice, PageHeader, Panel } from "@/components/dash/ui";
import { DELETE_CONFIRMATION } from "@/lib/account";
import { requireDashboardUser } from "@/lib/dashboard";
import { updatesOn } from "@/lib/email/preferences";
import { eventDay } from "@/components/dash/EventCard";
import { deleteMyAccount, saveBusinessName, setUpdateEmails } from "../actions";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage({ searchParams }: PageProps<"/account/settings">) {
  return (
    <Suspense>
      <Settings searchParams={searchParams} />
    </Suspense>
  );
}

async function Settings({ searchParams }: Pick<PageProps<"/account/settings">, "searchParams">) {
  const user = await requireDashboardUser("/account/settings");
  const sp = await searchParams;
  const updates = await updatesOn(user.id);

  return (
    <>
      <PageHeader title="Settings" intro="Your profile, sign-in and emails." />
      {sp.done === "profile" && <Notice>Saved.</Notice>}
      {sp.done === "emails" && <Notice>Email preferences saved.</Notice>}

      <div className="grid max-w-4xl gap-6">
        <Panel title={<span className="flex items-center gap-3"><IconChip icon={Building2} className="size-9" /> Profile</span>}>
          <div className="mb-5 flex items-center gap-4">
            <Avatar name={user.displayName} big />
            <div className="min-w-0">
              <p className="truncate font-semibold">{user.displayName}</p>
              <p className="flex items-center gap-1.5 truncate text-sm text-muted"><Mail className="size-3.5" aria-hidden /> {user.email}</p>
            </div>
          </div>
          <form action={saveBusinessName} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className={`${field} flex-1`}>
              Business name
              <input name="name" defaultValue={user.business ?? ""} maxLength={80} placeholder="Photo Booth Hire Swansea" className={input} />
            </label>
            <button className={btnPrimary}>Save</button>
          </form>
          <p className="mt-2 text-xs text-muted">Shown in your dashboard and on your public homepage.</p>
        </Panel>

        <Panel title={<span className="flex items-center gap-3"><IconChip icon={KeyRound} tone="violet" className="size-9" /> Password</span>} description="Choose a new password for signing in with your email. If you sign in with Google, you don't need one.">
          <div className="max-w-md">
            <ResetForm step="new" />
          </div>
        </Panel>

        <Panel id="emails" title={<span className="flex items-center gap-3"><IconChip icon={Bell} tone="blue" className="size-9" /> Emails</span>}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-xl text-sm text-muted">
              {updates ? "We email you when a new version of DSLR Snap is out." : "You won't get emails about new versions."} Emails about your account, payments and security always arrive.
            </p>
            <form action={setUpdateEmails}>
              <input type="hidden" name="on" value={updates ? "0" : "1"} />
              <button role="switch" aria-checked={updates} aria-label="Update emails" className={`relative h-7 w-12 rounded-full transition-colors ${updates ? "bg-accent" : "bg-surface-2 ring-1 ring-line"}`}>
                <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${updates ? "left-6" : "left-1"}`} />
              </button>
            </form>
          </div>
        </Panel>

        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Sign out</p>
              <p className="text-sm text-muted">Signs out of this browser. Your booth computers stay signed in.</p>
            </div>
            <form action={signOut}><button className={btn}><LogOut className="size-4" /> Sign out</button></form>
          </div>
        </Panel>

        <details id="delete" className="group rounded-2xl border border-bad/30 bg-bad/[0.03] p-5 sm:p-6" open={sp.error === "confirm-delete" || sp.error === "delete"}>
          <summary className="flex cursor-pointer list-none items-center gap-3 font-semibold text-bad [&::-webkit-details-marker]:hidden">
            <IconChip icon={TriangleAlert} tone="rose" className="size-9" /> Delete your account
          </summary>
          <div className="mt-4 flex flex-col gap-3 text-sm text-muted">
            <p>This can&apos;t be undone. Straight away:</p>
            <ul className="list-disc pl-5">
              {user.ent.active && !user.ent.complimentary && (
                <li>Your plan ends now, with no refund for the time left. To stop renewing but keep using it until {user.ent.periodEnd ? eventDay(user.ent.periodEnd) : "the end of the period"}, cancel under Plan & billing instead.</li>
              )}
              <li>Every booth computer is signed out and drops to the free trial.</li>
              <li>Every cloud gallery, QR link and host page stops working, and their photos and videos are deleted.</li>
            </ul>
            <p>Photos on your booth computers aren&apos;t touched. Stripe keeps your invoices, as the law requires.</p>
            {sp.error === "confirm-delete" && <p className="text-bad">Type {DELETE_CONFIRMATION} in capitals to confirm.</p>}
            {sp.error === "delete" && <p className="text-bad">Something went wrong and nothing was deleted. Try again, or chat with us.</p>}
            <form action={deleteMyAccount} className="flex flex-wrap items-end gap-3">
              <label className={field}>
                Type {DELETE_CONFIRMATION} to confirm
                <input name="confirm" autoComplete="off" required className={input} />
              </label>
              <button className={btnDanger}>Delete my account</button>
            </form>
          </div>
        </details>
      </div>
    </>
  );
}
