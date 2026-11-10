import { describe, expect, it } from "vitest";
import { clean, deviceFrom, downloadFrom, sourceFrom, trackedPath } from "./track";

describe("trackedPath", () => {
  it("keeps public pages, without query or trailing slash", () => {
    expect(trackedPath("/")).toBe("/");
    expect(trackedPath("/pricing?plan=yearly#faq")).toBe("/pricing");
    expect(trackedPath("/solutions/360-photo-booth-software/")).toBe("/solutions/360-photo-booth-software");
  });
  it("never tracks private links, the API or the admin", () => {
    for (const p of ["/e/abc123", "/b/someone", "/s/x", "/app/sign-in", "/auth/callback", "/api/t", "/email/unsubscribe", "/office", "/office/customers"]) {
      expect(trackedPath(p, "office")).toBeNull();
    }
    expect(trackedPath("/officer", "office")).toBe("/officer");
  });
  it("keeps only the section of account pages, so ids aren't stored", () => {
    expect(trackedPath("/account/events/5f0c0b7e-1111")).toBe("/account/events");
    expect(trackedPath("/account")).toBe("/account");
  });
  it("refuses anything that isn't a plain same-site path", () => {
    for (const p of ["https://evil.com/", "//evil.com", "pricing", "/<script>", 42, null]) expect(trackedPath(p)).toBeNull();
  });
});

describe("sourceFrom", () => {
  it("names well-known sites, Gemini before Google", () => {
    expect(sourceFrom("https://www.google.co.uk/", null, "dslrsnap.com")).toBe("Google");
    expect(sourceFrom("https://gemini.google.com/app", null, "dslrsnap.com")).toBe("Gemini");
    expect(sourceFrom("https://chatgpt.com/", null, "dslrsnap.com")).toBe("ChatGPT");
    expect(sourceFrom("https://l.facebook.com/l.php", null, "dslrsnap.com")).toBe("Facebook");
    expect(sourceFrom("https://t.co/abc", null, "dslrsnap.com")).toBe("X");
  });
  it("prefers the utm_source tag, and ignores the site's own pages", () => {
    expect(sourceFrom("https://www.google.com/", "Newsletter", "dslrsnap.com")).toBe("newsletter");
    expect(sourceFrom("https://dslrsnap.com/pricing", null, "dslrsnap.com")).toBeNull();
    expect(sourceFrom("https://www.dslrsnap.com/", null, "dslrsnap.com")).toBeNull();
  });
  it("falls back to the host, or nothing for junk", () => {
    expect(sourceFrom("https://www.photoboothforum.co.uk/t/1", null, "dslrsnap.com")).toBe("photoboothforum.co.uk");
    expect(sourceFrom("not a url", null, "dslrsnap.com")).toBeNull();
    expect(sourceFrom("", "", "dslrsnap.com")).toBeNull();
  });
});

describe("small helpers", () => {
  it("cleans labels to one short line", () => {
    expect(clean("  Start\n free\ttrial  ", 40)).toBe("Start free trial");
    expect(clean("x".repeat(100), 10)).toHaveLength(10);
    expect(clean("   ", 10)).toBeNull();
    expect(clean(5, 10)).toBeNull();
  });
  it("tells phones, tablets and computers apart", () => {
    expect(deviceFrom("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148")).toBe("phone");
    expect(deviceFrom("Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36")).toBe("phone");
    expect(deviceFrom("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)")).toBe("tablet");
    expect(deviceFrom("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140")).toBe("computer");
  });
  it("accepts only short words for where a download came from", () => {
    expect(downloadFrom("dashboard")).toBe("dashboard");
    expect(downloadFrom("<b>")).toBe("direct");
    expect(downloadFrom(undefined)).toBe("direct");
  });
});
