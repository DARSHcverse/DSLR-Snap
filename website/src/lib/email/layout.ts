import { productionUrl, site } from "../site";

/**
 * One design for every DSLR Snap email: logo, white card, orange button, signature footer.
 * Table layout and inline styles, because Gmail and Outlook ignore most CSS. Pure functions, so the
 * same output is used in tests, previews and the real send.
 */

export type Block =
  | { p: string } // a paragraph; **bold** is allowed
  | { button: string; url: string }
  | { facts: [string, string][] } // a small two-column summary (plan, amount, date…)
  | { steps: string[] } // numbered steps, left-aligned
  | { code: string } // a one-time code, shown large
  | { quote: string; by?: string } // a customer's message, in a chat reply
  | { note: string } // small grey print under the main content
  | { divider: true };

export interface EmailContent {
  subject: string;
  /** The grey preview line inboxes show after the subject. */
  preheader: string;
  heading: string;
  blocks: Block[];
  /** Update emails carry an unsubscribe link; account and payment emails don't need one. */
  unsubscribeUrl?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const C = {
  page: "#f4f2ee",
  card: "#ffffff",
  ink: "#16161d",
  muted: "#6b6b76",
  line: "#e8e5df",
  accent: "#ff7a59",
  accentInk: "#1a0d08",
  soft: "#fff3ee",
};
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const base = productionUrl;

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Escapes, then turns **x** into bold and line breaks into <br>. */
function inline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, `<strong style="color:${C.ink};font-weight:600">$1</strong>`)
    .replace(/\n/g, "<br>");
}

function block(b: Block): string {
  if ("p" in b) return `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3a3a44">${inline(b.p)}</p>`;
  if ("button" in b) {
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px"><tr><td align="center" bgcolor="${C.accent}" style="border-radius:999px">
<a href="${escapeHtml(b.url)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;font-weight:600;color:${C.accentInk};text-decoration:none;border-radius:999px">${escapeHtml(b.button)}</a>
</td></tr></table>`;
  }
  if ("facts" in b) {
    const rows = b.facts
      .map(
        ([k, v], i) => `<tr><td style="padding:10px 0;${i ? `border-top:1px solid ${C.line};` : ""}font-size:14px;color:${C.muted}">${escapeHtml(k)}</td>
<td align="right" style="padding:10px 0;${i ? `border-top:1px solid ${C.line};` : ""}font-size:14px;font-weight:600;color:${C.ink}">${escapeHtml(v)}</td></tr>`,
      )
      .join("");
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px;background:${C.page};border-radius:12px"><tr><td style="padding:6px 18px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr></table>`;
  }
  if ("steps" in b) {
    const rows = b.steps
      .map(
        (t, i) => `<tr><td valign="top" width="34" style="padding:7px 0"><div style="width:24px;height:24px;line-height:24px;border-radius:12px;background:${C.soft};color:${C.accent};font-size:13px;font-weight:700;text-align:center">${i + 1}</div></td>
<td valign="top" style="padding:9px 0 7px;font-size:15px;line-height:1.5;color:${C.ink}">${inline(t)}</td></tr>`,
      )
      .join("");
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px">${rows}</table>`;
  }
  if ("code" in b) {
    return `<p style="margin:4px 0 24px;padding:16px;background:${C.page};border-radius:12px;text-align:center;font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:30px;letter-spacing:8px;font-weight:700;color:${C.ink}">${escapeHtml(b.code)}</p>`;
  }
  if ("quote" in b) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px"><tr><td style="padding:14px 18px;background:${C.soft};border-left:3px solid ${C.accent};border-radius:0 12px 12px 0;font-size:15px;line-height:1.6;color:#3a3a44">
${inline(b.quote)}${b.by ? `<div style="margin-top:8px;font-size:13px;color:${C.muted}">${escapeHtml(b.by)}</div>` : ""}</td></tr></table>`;
  }
  if ("note" in b) return `<p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:${C.muted}">${inline(b.note)}</p>`;
  return `<hr style="border:none;border-top:1px solid ${C.line};margin:8px 0 24px">`;
}

function textBlock(b: Block): string {
  const plain = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "$1");
  if ("p" in b) return plain(b.p);
  if ("button" in b) return `${b.button}: ${b.url}`;
  if ("facts" in b) return b.facts.map(([k, v]) => `${k}: ${v}`).join("\n");
  if ("steps" in b) return b.steps.map((t, i) => `${i + 1}. ${plain(t)}`).join("\n");
  if ("code" in b) return b.code;
  if ("quote" in b) return `> ${plain(b.quote).replace(/\n/g, "\n> ")}${b.by ? `\n  ${b.by}` : ""}`;
  if ("note" in b) return plain(b.note);
  return "---";
}

/** The signature at the bottom of every email (and the same look as the Gmail signature). */
function signature(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle" style="padding-right:14px"><img src="${base}/email/logo-icon.png" width="44" height="44" alt="" style="display:block;border:0;border-radius:10px"></td>
<td valign="middle" style="font-family:${FONT};font-size:13px;line-height:1.55;color:${C.muted}">
<strong style="color:${C.ink};font-size:14px">The DSLR Snap team</strong><br>
Photo booth software for Windows and Surface<br>
<a href="mailto:${site.contactEmail}" style="color:${C.muted};text-decoration:none">${site.contactEmail}</a> · <a href="mailto:${site.supportEmail}" style="color:${C.muted};text-decoration:none">${site.supportEmail}</a> · <a href="${base}" style="color:${C.accent};text-decoration:none;font-weight:600">dslrsnap.com</a>
</td></tr></table>`;
}

export function renderEmail(e: EmailContent): RenderedEmail {
  const body = e.blocks.map(block).join("\n");
  const footerLinks = [
    `<a href="${base}/account" style="color:${C.muted}">Your account</a>`,
    `<a href="${base}/support" style="color:${C.muted}">Help</a>`,
    ...(e.unsubscribeUrl ? [`<a href="${escapeHtml(e.unsubscribeUrl)}" style="color:${C.muted}">Unsubscribe from updates</a>`] : []),
  ].join(" &nbsp;·&nbsp; ");

  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(e.subject)}</title>
<style>
  body { margin:0; padding:0; }
  a { color:${C.accent}; }
  @media (max-width:620px) { .card { padding:28px 22px !important; } .outer { padding:16px 10px !important; } h1 { font-size:24px !important; } }
</style>
</head>
<body style="margin:0;padding:0;background:${C.page};font-family:${FONT};-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(e.preheader)}${"&#8199;&#65279;&#847; ".repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page}">
<tr><td align="center" class="outer" style="padding:32px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">
    <tr><td style="padding:0 8px 22px"><a href="${base}"><img src="${base}/email/logo-wordmark.png" width="150" alt="DSLR Snap" style="display:block;border:0;height:auto"></a></td></tr>
    <tr><td class="card" style="background:${C.card};border-radius:20px;padding:40px 40px 28px;border:1px solid ${C.line}">
      <h1 style="margin:0 0 18px;font-size:26px;line-height:1.25;font-weight:700;letter-spacing:-0.4px;color:${C.ink}">${escapeHtml(e.heading)}</h1>
      ${body}
      <hr style="border:none;border-top:1px solid ${C.line};margin:20px 0 22px">
      ${signature()}
    </td></tr>
    <tr><td align="center" style="padding:22px 16px 0;font-size:12px;line-height:1.7;color:${C.muted}">
      ${footerLinks}<br>
      DSLR Snap · <a href="${base}" style="color:${C.muted};text-decoration:none">dslrsnap.com</a>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    e.heading,
    "",
    ...e.blocks.map(textBlock).flatMap((t) => [t, ""]),
    "—",
    "The DSLR Snap team",
    `${site.contactEmail} · ${site.supportEmail} · dslrsnap.com`,
    ...(e.unsubscribeUrl ? ["", `Unsubscribe from updates: ${e.unsubscribeUrl}`] : []),
  ].join("\n");

  return { subject: e.subject, html, text };
}
