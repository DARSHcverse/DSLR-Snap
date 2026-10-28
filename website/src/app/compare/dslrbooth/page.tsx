import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { ContentPage } from "@/components/ContentPage";
import { Icon } from "@/components/Icon";
import { COMPARISON } from "@/lib/marketing";

export const metadata: Metadata = pageMetadata({
  title: "DSLR Snap vs dslrBooth (LumaBooth for Windows)",
  description:
    "Comparing DSLR Snap with dslrBooth: monthly and yearly prices, computers included, phone remote, cloud gallery and free trial.",
  path: "/compare/dslrbooth",
});

export default function CompareDslrBooth() {
  return (
    <ContentPage
      eyebrow="Compare"
      title="DSLR Snap vs dslrBooth"
      intro="dslrBooth (now LumaBooth for Windows) is a well-known booth app. Here's how the plans compare, using the prices on their public pricing page."
      narrow
    >
      <div className="overflow-x-auto rounded-card border border-line">
        <table className="w-full text-left">
          <thead className="bg-surface-2 text-sm">
            <tr>
              <th className="p-4 font-semibold" />
              <th className="p-4 font-semibold">dslrBooth</th>
              <th className="p-4 font-semibold text-accent">DSLR Snap</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {COMPARISON.rows.map((r) => (
              <tr key={r.label}>
                <th className="p-4 font-medium">{r.label}</th>
                <td className="p-4 text-muted">{r.them}</td>
                <td className="p-4">{r.us}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="mt-12 font-display text-2xl font-bold">Also in DSLR Snap</h2>
      <ul className="mt-4 space-y-2.5">
        {COMPARISON.extras.map((e) => (
          <li key={e} className="flex items-start gap-2.5">
            <Icon name="check" className="mt-0.5 size-5 shrink-0 text-ok" />
            {e}
          </li>
        ))}
      </ul>
      <p className="mt-10 text-sm text-muted">
        dslrBooth and LumaBooth are trademarks of their owner; DSLR Snap is not affiliated with them. Their prices were checked on their public pricing
        page in {COMPARISON.checked} and may have changed since.
      </p>
    </ContentPage>
  );
}
