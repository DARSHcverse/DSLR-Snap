import { describe, expect, it } from "vitest";
import { htmlToText, parseReplyAddress, replyAddress, stripQuoted } from "./inbound";

const KEY = "test-key", DOMAIN = "reply.dslrsnap.com";
const THREAD = "9259b332-6e6f-47b4-ac7d-e367319345fa";

describe("reply addresses", () => {
  it("round-trip the thread and who is replying", () => {
    const c = replyAddress(THREAD, "customer", KEY, DOMAIN);
    expect(c).toMatch(/^c-9259b3326e6f47b4ac7de367319345fa-[0-9a-z]{16}@reply\.dslrsnap\.com$/);
    expect(parseReplyAddress(c, KEY, DOMAIN)).toEqual({ thread: THREAD, role: "customer" });
    expect(parseReplyAddress(replyAddress(THREAD, "admin", KEY, DOMAIN).toUpperCase(), KEY, DOMAIN)).toEqual({ thread: THREAD, role: "admin" });
  });

  it("refuse forged, re-pointed or foreign addresses", () => {
    const c = replyAddress(THREAD, "customer", KEY, DOMAIN);
    expect(parseReplyAddress(c.replace(/^c-/, "a-"), KEY, DOMAIN)).toBeNull(); // customer can't become admin
    expect(parseReplyAddress(c.replace("9259b332", "0000b332"), KEY, DOMAIN)).toBeNull(); // another thread
    expect(parseReplyAddress(c, "other-key", DOMAIN)).toBeNull();
    expect(parseReplyAddress(c, KEY, "evil.example")).toBeNull();
    expect(parseReplyAddress("support@dslrsnap.com", KEY, DOMAIN)).toBeNull();
  });
});

describe("the new part of a reply", () => {
  it("cuts Gmail, Apple Mail and Outlook quoted history", () => {
    expect(stripQuoted("Thanks, that worked!\n\nOn Tue, 28 Oct 2026 at 16:42, DSLR Snap <hello@dslrsnap.com> wrote:\n> Hi Priya")).toBe("Thanks, that worked!");
    expect(stripQuoted("Still stuck.\n\nOn Tue, 28 Oct 2026 at 16:42, DSLR Snap\n<hello@dslrsnap.com> wrote:\n> Hi")).toBe("Still stuck.");
    expect(stripQuoted("Yes please\r\n\r\n-----Original Message-----\r\nFrom: DSLR Snap")).toBe("Yes please");
    expect(stripQuoted("ok\n\nFrom: DSLR Snap <hello@dslrsnap.com>\nSent: Tuesday")).toBe("ok");
    expect(stripQuoted("Will try now\n\nSent from my iPhone")).toBe("Will try now");
    expect(stripQuoted("> quoted only")).toBe("");
  });

  it("keeps multi-paragraph replies intact", () => {
    expect(stripQuoted("Line one.\n\nLine two.\n\n\n\nLine three.")).toBe("Line one.\n\nLine two.\n\nLine three.");
  });

  it("turns HTML into readable text", () => {
    expect(htmlToText("<div>Hi&nbsp;there<br>New line</div><p>Para &amp; more</p><style>p{}</style>").trim()).toBe("Hi there\nNew line\nPara & more");
  });
});
