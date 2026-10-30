import { site } from "@/lib/site";

/**
 * Who "we" are, from lib/site.ts: a company once incorporated, otherwise the sole trader trading as
 * DSLR Snap. The full geographic address is required here by UK law even though we only sell online.
 */
export function WhoWeAre() {
  const b = site.business;
  const who = b.legalName
    ? <><strong>{b.legalName}</strong>{b.companyNumber ? `, a company registered in ${b.jurisdiction} (number ${b.companyNumber})` : ""}</>
    : b.owner
      ? <><strong>{b.owner}</strong>, trading as <strong>{site.name}</strong></>
      : <strong>{site.name}</strong>;
  return (
    <div className="rounded-xl border border-line bg-surface p-5 text-sm">
      <p className="font-semibold text-fg">Who we are</p>
      <p className="mt-2 text-muted">
        {b.legalName || b.owner ? <>{site.name} is provided by {who}</> : who} (&quot;we&quot;, &quot;us&quot;), {b.legalName || b.owner ? "of" : "based at"} {b.address}, {b.country}
        {b.vatNumber ? `. VAT number ${b.vatNumber}` : ""}
        {b.icoNumber ? `. Registered with the Information Commissioner's Office, number ${b.icoNumber}` : ""}.
      </p>
      <p className="mt-2 text-muted">
        Email <a href={`mailto:${site.supportEmail}`} className="text-accent">{site.supportEmail}</a> (fastest) or call{" "}
        <a href={`tel:${b.phone.replace(/\s/g, "")}`} className="text-accent">{b.phone}</a>. We sell online only; please don&apos;t visit the address without arranging it first.
      </p>
    </div>
  );
}

export const LAST_UPDATED = "30 October 2026";
