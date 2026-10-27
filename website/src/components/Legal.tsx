import { site, tradingName } from "@/lib/site";

const missing = "[to be added]";

/** Who "we" are, from lib/site.ts. Gaps show as "[to be added]" until the business details are filled in. */
export function WhoWeAre() {
  const b = site.business;
  return (
    <p>
      DSLR Snap is provided by <strong>{tradingName}</strong>
      {b.companyNumber ? `, company number ${b.companyNumber}` : ""}, of {b.address || missing}, {b.country}
      {b.vatNumber ? ` (VAT ${b.vatNumber})` : ""}. Contact: <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.
    </p>
  );
}

export const LAST_UPDATED = "27 October 2026";
