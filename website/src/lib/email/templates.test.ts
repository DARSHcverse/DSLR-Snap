import { describe, expect, it } from "vitest";
import { renderEmail } from "./layout";
import * as t from "./templates";

describe("email design", () => {
  it("escapes anything a customer typed", () => {
    const e = t.teamNotice({ title: "Message", facts: [["From", "<script>alert(1)</script>"]], message: 'He said "hi" & <b>left</b>' });
    expect(e.html).not.toContain("<script>alert");
    expect(e.html).toContain("&lt;script&gt;");
    expect(e.html).toContain("&lt;b&gt;left&lt;/b&gt;");
  });

  it("only update emails carry an unsubscribe link; account emails never do", () => {
    const update = t.appUpdate({ version: "1.2.0", highlights: ["Faster"], unsubscribeUrl: "https://dslrsnap.com/email/unsubscribe?t=abc" });
    expect(update.html).toContain("Unsubscribe from updates");
    expect(update.text).toContain("https://dslrsnap.com/email/unsubscribe?t=abc");
    expect(t.paymentFailed({ amountCents: 3000 }).html).not.toContain("Unsubscribe");
  });

  it("the contact confirmation never repeats what a visitor typed", () => {
    expect(t.contactReceived({ topic: "Billing and account" }).html).not.toMatch(/border-left:3px/); // no quote block
  });

  it("every email has the signature, both addresses and a plain-text version", () => {
    for (const e of [t.welcome(), t.resetPassword("https://x"), t.planEnded(), t.reauthCode("123456")]) {
      expect(e.html).toContain("The DSLR Snap team");
      expect(e.html).toContain("hello@dslrsnap.com");
      expect(e.html).toContain("support@dslrsnap.com");
      expect(e.text.length).toBeGreaterThan(40);
      expect(e.html).not.toMatch(/gmail\.com/i);
    }
  });

  it("formats bold and prices", () => {
    expect(renderEmail({ subject: "s", preheader: "p", heading: "h", blocks: [{ p: "a **b** c" }] }).html).toContain("<strong");
    expect(t.usd(16800)).toBe("US$168");
    expect(t.usd(550)).toBe("US$5.50");
  });
});
