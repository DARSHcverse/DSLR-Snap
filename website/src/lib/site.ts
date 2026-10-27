export const site = {
  name: "DSLR Snap",
  title: "DSLR Snap – Photo Booth Software for Windows",
  description:
    "Photo booth software for Windows: DSLR photo booth, glam B&W, green screen and AI backgrounds, 360 booth with GoPro, video guestbook, boomerangs and QR sharing. Works offline at events.",
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

// Vercel sets VERCEL_PROJECT_PRODUCTION_URL on every deployment; localhost covers `next dev`.
export const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const earlyAccessHref = `mailto:${site.contactEmail}?subject=${encodeURIComponent(
  "DSLR Snap early access",
)}`;
