import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Email replies into the support chat. Each support email carries its own Reply-To address,
 *   c-<thread>-<sig>@reply.dslrsnap.com   (the customer answering us)
 *   a-<thread>-<sig>@reply.dslrsnap.com   (the team answering from their inbox)
 * signed with a server secret, so nobody can post into a conversation they weren't sent.
 */
export type ReplyRole = "customer" | "admin";

const sig = (role: ReplyRole, thread: string, key: string) =>
  createHmac("sha256", key).update(`${role}:${thread}`).digest("base64url").replace(/[^A-Za-z0-9]/g, "").slice(0, 16).toLowerCase();

export function replyAddress(thread: string, role: ReplyRole, key: string, domain: string): string {
  const id = thread.replace(/-/g, "").toLowerCase();
  return `${role === "admin" ? "a" : "c"}-${id}-${sig(role, id, key)}@${domain}`;
}

/** The thread and role behind a reply address, or null if it isn't one of ours or the signature is wrong. */
export function parseReplyAddress(address: string, key: string, domain: string): { thread: string; role: ReplyRole } | null {
  const m = address.trim().toLowerCase().match(/^([ac])-([0-9a-f]{32})-([0-9a-z]{16})@(.+)$/);
  if (!m || m[4] !== domain.toLowerCase() || !key) return null;
  const role: ReplyRole = m[1] === "a" ? "admin" : "customer";
  const expected = Buffer.from(sig(role, m[2], key));
  const given = Buffer.from(m[3]);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const h = m[2];
  return { thread: `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`, role };
}

/** Plain text from an HTML email body (only used when the email has no text part). */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h\d|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

// Where the quoted earlier email starts, in the common clients.
const QUOTE_STARTS = [
  /^On .{4,200}wrote:\s*$/, // Gmail, Apple Mail
  /^Le .{4,200}a écrit\s*:\s*$/,
  /^-{2,}\s*Original Message\s*-{2,}/i, // Outlook
  /^_{10,}\s*$/, // Outlook web
  /^From:\s.+/, // Outlook header block
  /^Sent from my (iPhone|iPad|Android|phone)/i,
  /^Get Outlook for /i,
];

/** The new part of a reply: everything before the quoted history, without trailing blank lines. */
export function stripQuoted(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Gmail sometimes wraps "On … wrote:" over two lines.
    const joined = `${line} ${lines[i + 1] ?? ""}`.trim();
    if (QUOTE_STARTS.some((re) => re.test(line.trim())) || /^On .{4,200}wrote:\s*$/.test(joined)) break;
    if (/^\s*>/.test(line)) break;
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
