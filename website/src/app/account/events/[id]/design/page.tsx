import type { Metadata } from "next";
import { Suspense } from "react";
import { Panel } from "@/components/dash/ui";
import { designForEvent } from "@/lib/cloudDesign";
import { DesignEditor } from "../DesignEditor";
import { ownedEvent } from "../data";

export const metadata: Metadata = { title: "Design" };

export default function DesignPage({ params }: PageProps<"/account/events/[id]/design">) {
  return (
    <Suspense>
      <Design params={params} />
    </Suspense>
  );
}

async function Design({ params }: Pick<PageProps<"/account/events/[id]/design">, "params">) {
  const { id } = await params;
  const { user, event, sessions } = await ownedEvent(id);
  const look = await designForEvent(user.id, event.design);
  return (
    <Panel title="Gallery design" description="Colours, font, banner, logo and background for this event's gallery. The preview uses its real photos.">
      <DesignEditor
        eventId={event.id}
        eventName={event.name}
        initial={look.design}
        images={look.images}
        samples={sessions.filter((s) => !s.hidden).slice(0, 6).map((s) => s.photo)}
        custom={!!event.design}
      />
    </Panel>
  );
}
