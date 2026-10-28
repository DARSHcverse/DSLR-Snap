import { productionUrl, site } from "../site";
import { type Block, type EmailContent, renderEmail, type RenderedEmail } from "./layout";

/**
 * Every email DSLR Snap sends. Each returns subject + HTML + plain text, built on layout.ts, so the
 * whole set looks the same and can be previewed with `npm run email:preview`.
 */

const base = productionUrl;
const date = (d: Date | string | number) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
export const usd = (cents: number) => `US$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
const plainName = (plan: "monthly" | "yearly" | null | undefined) => (plan === "monthly" ? "Monthly" : plan === "yearly" ? "Yearly" : "DSLR Snap");
const ignore = (what: string): Block => ({ note: `If you didn't ${what}, you can ignore this email. Nothing will change.` });
const r = (e: EmailContent) => renderEmail(e);

// ---------- Sign-in emails (sent for Supabase through the Send Email hook) ----------

export const confirmSignup = (url: string): RenderedEmail =>
  r({
    subject: "Confirm your email for DSLR Snap",
    preheader: "One click and your account is ready.",
    heading: "Confirm your email",
    blocks: [
      { p: "Thanks for signing up to DSLR Snap. Confirm your email address and your account is ready to use." },
      { button: "Confirm my email", url },
      { note: "The link works once and expires in 24 hours." },
      ignore("create a DSLR Snap account"),
    ],
  });

export const resetPassword = (url: string): RenderedEmail =>
  r({
    subject: "Reset your DSLR Snap password",
    preheader: "Choose a new password in a minute.",
    heading: "Reset your password",
    blocks: [
      { p: "Someone (hopefully you) asked to reset the password for your DSLR Snap account. Choose a new one here:" },
      { button: "Choose a new password", url },
      { note: "The link works once and expires in 1 hour. Your booths stay signed in." },
      ignore("ask for this"),
    ],
  });

export const magicLink = (url: string): RenderedEmail =>
  r({
    subject: "Your DSLR Snap sign-in link",
    preheader: "Sign in with one click.",
    heading: "Sign in to DSLR Snap",
    blocks: [{ button: "Sign in", url }, { note: "The link works once and expires in 1 hour." }, ignore("try to sign in")],
  });

export const emailChange = (url: string, newEmail: string): RenderedEmail =>
  r({
    subject: "Confirm your new email address",
    preheader: `Confirm ${newEmail} for your DSLR Snap account.`,
    heading: "Confirm your new email",
    blocks: [
      { p: `Confirm that **${newEmail}** should be the email for your DSLR Snap account from now on.` },
      { button: "Confirm new email", url },
      ignore("ask to change your email"),
    ],
  });

export const inviteUser = (url: string): RenderedEmail =>
  r({
    subject: "You're invited to DSLR Snap",
    preheader: "Set your password and you're in.",
    heading: "You're invited",
    blocks: [{ p: "An account has been created for you on DSLR Snap. Set a password to start." }, { button: "Accept invitation", url }],
  });

export const reauthCode = (code: string): RenderedEmail =>
  r({
    subject: `${code} is your DSLR Snap code`,
    preheader: "Use this code to confirm it's you.",
    heading: "Confirm it's you",
    blocks: [{ p: "Enter this code to continue:" }, { code }, ignore("ask for a code")],
  });

// ---------- Account and billing ----------

export const welcome = (): RenderedEmail =>
  r({
    subject: "Welcome to DSLR Snap",
    preheader: "Your account is ready. Here's how to get your first booth running.",
    heading: "Welcome to DSLR Snap 👋",
    blocks: [
      { p: "Your account is ready. Everything works on the free trial, with a small watermark on photos until you choose a plan." },
      { p: "**Get your first booth running:**" },
      { steps: ["Download and install DSLR Snap on your Windows booth computer", "Plug in your camera and printer: they're found automatically", "Create an event, pick a template and press **Start booth**"] },
      { button: "Download DSLR Snap", url: `${base}/download` },
      { p: `Stuck on anything? Reply to this email or write to ${site.supportEmail}. A real person answers.` },
    ],
  });

export const planStarted = (o: { plan: "monthly" | "yearly"; amountCents: number; renewsAt: string | number }): RenderedEmail =>
  r({
    subject: "You're all set: your DSLR Snap plan is active",
    preheader: "No more watermark. Here's what's included.",
    heading: "Your plan is active",
    blocks: [
      { p: "Thank you for choosing DSLR Snap. Your booths now print and share without the watermark." },
      { facts: [["Plan", `${plainName(o.plan)}`], ["Paid", usd(o.amountCents)], [o.plan === "yearly" ? "Renews" : "Next payment", date(o.renewsAt)], ["Booth computers", "2 included"]] },
      { p: "**On each booth computer:** open DSLR Snap → Account → Sign in. The watermark goes away straight after." },
      { button: "Go to your account", url: `${base}/account` },
      { note: "Stripe emails your receipt separately. Invoices are under Manage billing on your account page." },
    ],
  });

export const paymentFailed = (o: { amountCents: number; nextTry?: string | number | null }): RenderedEmail =>
  r({
    subject: "Your DSLR Snap payment didn't go through",
    preheader: "Update your card to keep your booths watermark-free.",
    heading: "Your payment didn't go through",
    blocks: [
      { p: `We couldn't take your payment of **${usd(o.amountCents)}**. This usually means the card expired or the bank declined it.` },
      { p: o.nextTry ? `We'll try again on ${date(o.nextTry)}. Updating your card now avoids any interruption.` : "Update your card to keep your plan running." },
      { button: "Update payment method", url: `${base}/account` },
      { note: "Your booths keep working offline for up to 14 days, so nothing stops mid-event." },
    ],
  });

export const renewalReminder = (o: { amountCents: number; renewsAt: string | number }): RenderedEmail =>
  r({
    subject: `Your DSLR Snap plan renews on ${date(o.renewsAt)}`,
    preheader: "A heads-up before your yearly renewal.",
    heading: "Your yearly plan renews soon",
    blocks: [
      { p: "Just a heads-up so there are no surprises." },
      { facts: [["Renews on", date(o.renewsAt)], ["Amount", usd(o.amountCents)]] },
      { p: "Nothing to do if you'd like to carry on. To change plan or cancel, use Manage billing on your account page." },
      { button: "Manage billing", url: `${base}/account` },
    ],
  });

export const cancellationScheduled = (o: { endsAt: string | number }): RenderedEmail =>
  r({
    subject: "Your DSLR Snap plan is cancelled",
    preheader: `You keep every feature until ${date(o.endsAt)}.`,
    heading: "Sorry to see you go",
    blocks: [
      { p: `Your plan won't renew. You keep everything until **${date(o.endsAt)}**, then your booths switch to the free trial with a watermark. Your photos and settings stay on your computers.` },
      { p: "Changed your mind? You can restart any time before then, and nothing is lost." },
      { button: "Keep my plan", url: `${base}/account` },
      { note: `We'd love to know why you're leaving. Just reply to this email.` },
    ],
  });

export const planEnded = (): RenderedEmail =>
  r({
    subject: "Your DSLR Snap plan has ended",
    preheader: "Your booths are back on the free trial.",
    heading: "Your plan has ended",
    blocks: [
      { p: "Your booths now run on the free trial: everything still works, with a small watermark on photos." },
      { p: "Your events, templates and photos are safe on your computers. Pick a plan whenever you're ready." },
      { button: "Choose a plan", url: `${base}/account` },
    ],
  });

export const extraComputersChanged = (o: { extra: number; total: number; priceEach: string }): RenderedEmail =>
  r({
    subject: o.extra ? `You now have ${o.total} booth computers` : "Extra booth computer removed",
    preheader: "Your booth computer allowance changed.",
    heading: "Booth computers updated",
    blocks: [
      { facts: [["Included", "2"], ["Extra", `${o.extra} × ${o.priceEach}`], ["Total", String(o.total)]] },
      { p: "Stripe adjusts your next invoice for the change." },
      { button: "See your computers", url: `${base}/account` },
    ],
  });

export const newDeviceSignedIn = (o: { device: string; at: string | number }): RenderedEmail =>
  r({
    subject: `New booth computer signed in: ${o.device}`,
    preheader: "A computer was just connected to your DSLR Snap account.",
    heading: "New booth computer connected",
    blocks: [
      { facts: [["Computer", o.device], ["When", new Date(o.at).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/London" })]] },
      { p: "If this was you, there's nothing to do." },
      { p: "**Not you?** Remove the computer on your account page and change your password." },
      { button: "Review computers", url: `${base}/account` },
    ],
  });

export const accountDeleted = (): RenderedEmail =>
  r({
    subject: "Your DSLR Snap account is deleted",
    preheader: "Your login, galleries and booth computers have been removed.",
    heading: "Your account is deleted",
    blocks: [
      { p: "As you asked, we've deleted your DSLR Snap login, booth computers and cloud galleries, and cancelled any plan. You won't be charged again." },
      { p: "The app keeps working on your computers as a free trial, and you're welcome back any time." },
      { note: `Didn't ask for this? Contact ${site.supportEmail} straight away.` },
    ],
  });

// ---------- Updates (with unsubscribe) ----------

export const appUpdate = (o: { version: string; highlights: string[]; unsubscribeUrl: string }): RenderedEmail =>
  r({
    subject: `DSLR Snap ${o.version} is here`,
    preheader: o.highlights[0] ?? "A new version of DSLR Snap is ready.",
    heading: `What's new in ${o.version}`,
    blocks: [
      ...o.highlights.map((h) => ({ p: `• ${h}` })),
      { p: "**How to update:** your booths download it by themselves and install it the next time you close DSLR Snap. It never installs during an event. To update now, open DSLR Snap → Home → Restart to update." },
      { button: "Download the latest version", url: `${base}/download` },
    ],
    unsubscribeUrl: o.unsubscribeUrl,
  });

// ---------- Support ----------

/**
 * Confirmation to whoever used the contact form. It deliberately doesn't repeat their message or
 * name: anyone can type any address into the form, so it mustn't carry text a stranger wrote.
 */
export const contactReceived = (o: { topic: string }): RenderedEmail =>
  r({
    subject: "We've got your message",
    preheader: "Thanks for getting in touch. We'll reply soon.",
    heading: "Thanks for getting in touch",
    blocks: [
      { p: `We've got your message about **${o.topic.toLowerCase()}** and will reply as soon as we can, usually within one working day.` },
      { p: "Need to add something? Just reply to this email." },
      { note: "Didn't write to us? Someone may have typed your address by mistake. You can ignore this email." },
    ],
  });

/** The team's answer. Customers with an account get a link to the chat; visitors just reply by email. */
export const supportReply = (o: { reply: string; url: string | null }): RenderedEmail =>
  r({
    subject: "New reply from DSLR Snap support",
    preheader: o.reply.slice(0, 90),
    heading: "You have a reply",
    blocks: [
      { quote: o.reply, by: "DSLR Snap support" },
      ...(o.url ? [{ button: "Open the conversation", url: o.url } as Block] : []),
      { note: o.url ? "Reply in the conversation so everything stays in one place, or reply to this email." : "Just reply to this email to carry on." },
    ],
  });

// ---------- To the DSLR Snap team ----------

/** Short notices to support@ (new customer, payment failed, new message…). */
export const teamNotice = (o: { title: string; facts: [string, string][]; message?: string; link?: { label: string; url: string } }): RenderedEmail =>
  r({
    subject: `[DSLR Snap] ${o.title}`,
    preheader: o.facts.map(([k, v]) => `${k}: ${v}`).join(" · "),
    heading: o.title,
    blocks: [
      { facts: o.facts },
      ...(o.message ? [{ quote: o.message } as Block] : []),
      ...(o.link ? [{ button: o.link.label, url: o.link.url } as Block] : []),
    ],
  });
