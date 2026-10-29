import { describe, expect, it } from "vitest";
import { cleanSlug, isBot, parseLinks, RESERVED_SLUGS } from "./cloudRules";

describe("analytics", () => {
  it("doesn't count link previews and crawlers", () => {
    for (const ua of ["WhatsApp/2.23.20.0", "facebookexternalhit/1.1", "Mozilla/5.0 (compatible; Googlebot/2.1)", "Slackbot-LinkExpanding 1.0", "curl/8.4.0", ""]) expect(isBot(ua)).toBe(true);
    expect(isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1")).toBe(false);
  });
});

describe("homepage address", () => {
  it("makes a clean lowercase address", () => {
    expect(cleanSlug("Photo Booth Hire Swansea!")).toBe("photo-booth-hire-swansea");
    expect(cleanSlug("  --PBH--  ")).toBe("pbh");
  });
  it("refuses empty, too short and reserved words", () => {
    expect(cleanSlug("")).toBeNull();
    expect(cleanSlug("a")).toBeNull();
    for (const r of ["admin", "dslrsnap", "account"]) expect(RESERVED_SLUGS.has(r) && cleanSlug(r)).toBeFalsy();
  });
});

describe("homepage links", () => {
  it("keeps up to five real links with labels", () => {
    const links = parseLinks([
      { label: "Instagram", url: "instagram.com/pbh" },
      { label: "", url: "https://ok.co.uk" },
      { label: "Bad", url: "javascript:alert(1)" },
      ...Array.from({ length: 6 }, (_, i) => ({ label: `L${i}`, url: `https://x${i}.com` })),
    ]);
    expect(links[0]).toEqual({ label: "Instagram", url: "https://instagram.com/pbh" });
    expect(links[1].label).toBe("ok.co.uk");
    expect(links.find((l) => l.label === "Bad")).toBeUndefined();
    expect(links).toHaveLength(5);
  });
});
