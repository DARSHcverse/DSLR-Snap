export const site = {
  name: "DSLR Snap",
  title: "DSLR Snap – Photo Booth Software for Windows",
  description:
    "Photo booth software for Windows and Surface Pro: Canon and Nikon DSLR booth, glam B&W, green screen and AI backgrounds, 360 with GoPro, video guestbook and QR sharing. Works offline.",
  /** Where early-access requests and support mail go. TODO(business): confirm the inbox exists. */
  contactEmail: "hello@dslrsnap.com",
  supportEmail: "support@dslrsnap.com",
  /**
   * Who runs DSLR Snap. UK law (E-Commerce Regulations 2002, Consumer Contracts Regulations 2013,
   * Companies Act 2006 s.1202 for a sole trader using a business name) needs the owner's name and a
   * geographic address on the website: the legal pages carry them in full, while the footer and
   * structured data only show the town.
   */
  business: {
    owner: "", // TODO(business): the sole trader's full legal name, until there is a company
    legalName: "", // a company's registered name, once incorporated (e.g. "DSLR Snap Ltd")
    companyNumber: "", // Companies House number, if a company
    vatNumber: "", // once VAT-registered
    icoNumber: "", // ICO data protection fee registration number
    address: "25 Robin Place, Boundary Way, Watford, WD25 7SL",
    locality: "Watford",
    postalCode: "WD25 7SL",
    country: "United Kingdom",
    phone: "+44 7544 193175",
    jurisdiction: "England and Wales",
  },
  /** TODO(marketing): add profile URLs as they're created; empty ones are hidden. */
  social: {
    instagram: "",
    facebook: "",
    youtube: "",
    tiktok: "",
  },
};

/** The trading name for legal text: the company name once set, otherwise the product name. */
export const tradingName = site.business.legalName || site.name;

/** The one canonical address (no www): sitemap, canonical links, Stripe and email links all use it. */
export const productionUrl = "https://dslrsnap.com";
// Every Vercel deployment points search engines at production; localhost covers `next dev`.
export const siteUrl = process.env.VERCEL ? productionUrl : "http://localhost:3000";

/** When the marketing copy last changed: the sitemap's lastmod. Bump it with real content changes. */
export const contentUpdated = "2026-10-30";

export const earlyAccessHref = `mailto:${site.contactEmail}?subject=${encodeURIComponent(
  "DSLR Snap early access",
)}`;
