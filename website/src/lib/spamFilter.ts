/**
 * Scores a contact-form message for unsolicited sales pitches (SEO, marketing and web agencies).
 * Each signal adds points; 3 or more is filtered. One signal alone (a customer mentioning SEO for
 * their own booth business, say) never filters a message, so real questions get through.
 * Filtered messages are kept in the admin's Filtered tab, never deleted.
 */
const SIGNALS: [reason: string, points: number, pattern: RegExp][] = [
  ["seo", 2, /\bseo\b/i],
  ["rankings", 2, /\brank(?:ing|ings)?\b(?:\s+\S+){0,4}\s+(?:on|in)\s+google|google\s+rank|first page of google/i],
  ["traffic", 2, /\b(?:website|organic|web|site)\s+traffic|grow your (?:website|traffic|business online)/i],
  ["visibility", 2, /\bonline\s+(?:visibility|presence|performance|reputation)/i],
  ["backlinks", 3, /\bback-?links?\b|\bguest\s+posts?\b|domain\s+authority/i],
  ["marketing", 2, /\bdigital\s+marketing|marketing\s+services|lead\s+generation|social media marketing/i],
  ["web agency", 2, /\b(?:development|design|marketing|seo)\s+agency|\bwebsite\s+(?:development|design|redesign)\b|\bapp\s+development\b/i],
  ["offer", 1, /\bfree\s+(?:audit|proposal|consultation|analysis|report)|\b(?:send|share)\s+(?:you\s+)?(?:a\s+)?(?:proposal|packages?|quote|pricing)|\bour\s+packages\b|\bshall i send\b/i],
  ["voice search", 1, /\balexa\b.*\bsiri\b|\bsiri\b.*\balexa\b|voice search/i],
  ["cold outreach", 1, /\breach(?:ing)? out\b|\bopen to exploring\b|\bwanted to connect\b|\bquick question about your website\b/i],
  ["cheap", 1, /\baffordable\s+(?:prices|rates|packages)|\blow[- ]cost\b/i],
  // Pitches greet the domain instead of a person: "Hello dslrsnap.com," / "Hey team dslrsnap.com".
  ["greets the domain", 2, /\b(?:hi|hello|hey|dear)\b[^.\n]{0,20}\bdslrsnap\.com\b/i],
];

export const SPAM_THRESHOLD = 3;

export function spamScore(text: string): { score: number; spam: boolean; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  for (const [reason, points, pattern] of SIGNALS) {
    if (pattern.test(text)) {
      score += points;
      reasons.push(reason);
    }
  }
  // Links to other websites: one point each, at most two.
  const links = (text.match(/https?:\/\/(?!(?:www\.)?dslrsnap\.com)[^\s)]+/gi) ?? []).length;
  if (links) {
    score += Math.min(2, links);
    reasons.push("links");
  }
  return { score, spam: score >= SPAM_THRESHOLD, reasons };
}
