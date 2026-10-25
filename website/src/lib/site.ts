export const site = {
  name: "DSLR Snap",
  title: "DSLR Snap – Photo Booth Software for Windows",
  description:
    "Photo booth software for Windows. Connect a Canon DSLR and a dye-sub printer, design your print in minutes, and run events that keep working even when the venue Wi-Fi doesn't.",
  // TODO: replace with the inbox that should receive early-access requests before going live.
  contactEmail: "hello@dslrsnap.com",
};

// Vercel sets VERCEL_PROJECT_PRODUCTION_URL on every deployment; localhost covers `next dev`.
export const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const earlyAccessHref = `mailto:${site.contactEmail}?subject=${encodeURIComponent(
  "DSLR Snap early access",
)}`;
