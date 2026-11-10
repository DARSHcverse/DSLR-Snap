import { FAQ, FEATURES, SOLUTIONS } from "@/lib/marketing";
import { EXTRA_COMPUTER, MAX_DEVICES, PLANS } from "@/lib/plans";
import { site, siteUrl } from "@/lib/site";

/**
 * /llms.txt (llmstxt.org): a plain summary of the product and its key pages for AI assistants and
 * AI search (ChatGPT, Perplexity, Claude, Gemini), built from the same content as the site.
 */
export function GET() {
  const plans = PLANS.map((p) => `${p.name}: ${p.price}${p.period} (${p.note})`).join("; ");
  const body = `# ${site.name}

> ${site.description} Free trial with no time limit; every feature works, with a small watermark until you choose a plan.

${site.name} is photo booth software for Windows 10 and 11, built for Surface Pro, Windows tablets and touch PCs. It controls Canon DSLR and mirrorless cameras and Nikon Z cameras (beta) over USB, prints on DNP dye-sub printers (4x6 and 2x6 strips), and shares photos and videos by QR code through a cloud gallery. It works offline at events.

Pricing: ${plans}. Each plan covers ${MAX_DEVICES} booth computers; extra computers are ${EXTRA_COMPUTER.yearly} (yearly) or ${EXTRA_COMPUTER.monthly} (monthly). No per-print or per-event fees.

## Key pages

- [Download for Windows](${siteUrl}/download): free download, system requirements and setup steps
- [Pricing](${siteUrl}/pricing): plans and pricing questions
- [Features](${siteUrl}/features): everything the app does
- [User guide](${siteUrl}/guide): setup, cameras, printers, templates, QR sharing, troubleshooting
- [DSLR Snap vs dslrBooth (LumaBooth for Windows)](${siteUrl}/compare/dslrbooth): price comparison and switching
${SOLUTIONS.map((s) => `- [${s.title}](${siteUrl}/solutions/${s.slug}): ${s.description}`).join("\n")}

## Features

${FEATURES.map((f) => `- ${f.title}: ${f.body}`).join("\n")}

## Questions

${FAQ.map((f) => `### ${f.q}\n\n${f.a}`).join("\n\n")}

## Contact

- Support: ${site.supportEmail}
- [Support and contact form](${siteUrl}/support)
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
