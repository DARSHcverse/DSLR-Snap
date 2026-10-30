import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getEvent, sessionsForOwner } from "@/lib/cloudEvents";
import { appUrl } from "@/lib/config";
import { requireDashboardUser } from "@/lib/dashboard";
import { isUuid } from "@/lib/gallery";

/**
 * The signed-in operator's event, its sessions and its public link, shared by the event layout and
 * each of its pages (cached for the request, so they read the database once).
 */
export const ownedEvent = cache(async (id: string) => {
  const user = await requireDashboardUser(`/account/events/${id}`);
  const event = isUuid(id) ? await getEvent(user.id, id) : null;
  if (!event) notFound();
  const sessions = await sessionsForOwner(event.id);
  return { user, event, sessions, link: `${appUrl}/e/${event.shareToken}` };
});
