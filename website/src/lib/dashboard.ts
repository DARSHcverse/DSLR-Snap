import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { entitlementFor } from "./account";
import { getCurrentUser, supabaseAdmin } from "./supabase/server";

/**
 * Who is signed in to the dashboard, with what the frame shows on every page (business name,
 * homepage address, plan, unread replies). Cached per request, so the layout and the page share one
 * lookup. Pages pass their own path so a signed-out visitor comes back to it after signing in.
 */
export const dashboardUser = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;
  const db = supabaseAdmin();
  const [ent, { data: profile }, { count: unread }] = await Promise.all([
    entitlementFor(user.id),
    db.from("customer_profiles").select("business_name, business_slug, homepage_enabled").eq("user_id", user.id).maybeSingle(),
    db.from("support_threads").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("unread_by_customer", true),
  ]);
  const business = profile?.business_name?.trim() || null;
  return {
    ...user,
    ent,
    /** What the dashboard calls the operator: their business, else the start of their email. */
    displayName: business ?? user.email.split("@")[0],
    business,
    homepage: profile?.business_slug ? { slug: profile.business_slug as string, enabled: !!profile.homepage_enabled } : null,
    unread: unread ?? 0,
  };
});

export type DashboardUser = NonNullable<Awaited<ReturnType<typeof dashboardUser>>>;

export async function requireDashboardUser(path: string): Promise<DashboardUser> {
  const user = await dashboardUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}`);
  return user;
}

/** "Free trial", "Yearly plan", "Free access"… for the sidebar and the overview. */
export function planLabel(u: DashboardUser): string {
  if (u.ent.complimentary) return "Free access";
  if (u.ent.active) return u.ent.plan === "monthly" ? "Monthly plan" : "Yearly plan";
  return "Free trial";
}
