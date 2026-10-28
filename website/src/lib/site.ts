export const site = {
  name: "DSLR Snap",
  title: "DSLR Snap – Photo Booth Software for Windows",
  description:
    "Photo booth software for Windows and Surface Pro: Canon and Nikon DSLR booth, glam B&W, green screen and AI backgrounds, 360 with GoPro, video guestbook and QR sharing. Works offline.",
  /** Where early-access requests and support mail go. TODO(business): confirm the inbox exists. */
  contactEmail: "hello@dslrsnap.com",
  supportEmail: "support@dslrsnap.com",
  /**
   * Shown in the footer, legal pages and structured data. TODO(business): fill these in before
   * taking payments; Stripe and UK law require the trading entity and a contact address.
   */
  business: {
    legalName: "", // e.g. "DSLR Snap Ltd"
    companyNumber: "", // Companies House number, if a company
    vatNumber: "", // once VAT-registered
    address: "", // registered / trading address
    country: "United Kingdom", // TODO(business): confirm
    jurisdiction: "England and Wales", // TODO(business): confirm governing law
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
export const contentUpdated = "2026-10-28";

export const earlyAccessHref = `mailto:${site.contactEmail}?subject=${encodeURIComponent(
  "DSLR Snap early access",
)}`;
