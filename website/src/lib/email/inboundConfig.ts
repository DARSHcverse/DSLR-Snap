import "server-only";
import { createHash } from "node:crypto";
import { licencePrivateKey } from "../config";
import { site } from "../site";
import { TEAM_EMAIL } from "./send";
import { replyAddress, type ReplyRole } from "./inbound";

/**
 * Email replies into the chat switch on once Resend receives mail for INBOUND_REPLY_DOMAIN
 * (e.g. reply.dslrsnap.com) and posts it to /api/email/inbound. Until then emails keep
 * Reply-To: support@ as before.
 */
export const inboundDomain = process.env.INBOUND_REPLY_DOMAIN?.trim().toLowerCase() || "";
export const inboundWebhookSecret = process.env.RESEND_INBOUND_WEBHOOK_SECRET ?? "";
/** Reading received mail needs a full-access Resend key; the sending key is send-only. */
export const receivingApiKey = process.env.RESEND_RECEIVING_API_KEY || process.env.RESEND_API_KEY || "";
export const inboundEnabled = !!(inboundDomain && inboundWebhookSecret && licencePrivateKey);

// Derived from the licence key, which never changes (changing it signs every booth out), so reply
// addresses in old emails keep working.
export const replyKey = createHash("sha256").update(`reply-address:${licencePrivateKey}`).digest("hex");

/** Reply-To for a support email: a signed per-conversation address, or support@ when receiving is off. */
export function replyToFor(thread: string, role: ReplyRole, fallback: string): string {
  return inboundEnabled ? replyAddress(thread, role, replyKey, inboundDomain) : fallback;
}

/** Who may answer as the team by email: the team inbox, hello@, and INBOUND_TEAM_SENDERS. */
export function isTeamSender(from: string): boolean {
  const allowed = [TEAM_EMAIL, site.contactEmail, site.supportEmail, ...(process.env.INBOUND_TEAM_SENDERS ?? "").split(",")]
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(from.trim().toLowerCase());
}
