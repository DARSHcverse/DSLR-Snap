import { Download, Eye, FileArchive, MonitorPlay, ScanLine, Users } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { BarChart } from "@/components/admin/BarChart";
import { StatCard } from "@/components/dash/ui";
import { statsForEvent } from "@/lib/galleryStats";
import { ownedEvent } from "../data";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage({ params }: PageProps<"/account/events/[id]/analytics">) {
  return (
    <Suspense>
      <Analytics params={params} />
    </Suspense>
  );
}

async function Analytics({ params }: Pick<PageProps<"/account/events/[id]/analytics">, "params">) {
  const { id } = await params;
  const { event } = await ownedEvent(id);
  const stats = await statsForEvent(event.id, 30);
  const t = stats.totals;
  const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={Eye} label="Gallery views" value={t.views} />
        <StatCard icon={Users} tone="violet" label="Unique visitors" value={t.visitors} />
        <StatCard icon={ScanLine} tone="blue" label="Guest pages opened" value={t.sessionViews} />
        <StatCard icon={Download} tone="green" label="Photo downloads" value={t.downloads} />
        <StatCard icon={FileArchive} tone="amber" label="Download all (zip)" value={t.zips} />
        <StatCard icon={MonitorPlay} tone="rose" label="Slideshow opens" value={t.slideshows} />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <BarChart
          title="Views per day (last 30 days)"
          bars={stats.days.map((d) => ({ label: day(d.day), value: d.views, display: `${d.views} views · ${d.visitors} visitors` }))}
          empty="No visits yet. Views appear here once you share the gallery."
        />
        <BarChart
          title="Downloads per day (last 30 days)"
          bars={stats.days.map((d) => ({ label: day(d.day), value: d.downloads, display: `${d.downloads} downloads` }))}
          empty="No downloads yet."
        />
      </div>
      <p className="text-xs text-muted">Counted without cookies; link previews and bots are left out. Visitors are counted once per day.</p>
    </div>
  );
}
