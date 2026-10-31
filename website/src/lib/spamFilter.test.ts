import { describe, expect, it } from "vitest";
import { spamScore } from "./spamFilter";

// The three pitches that actually arrived through the contact form (30–31 Oct 2026), shortened.
const PITCHES = [
  "Hey team dslrsnap.com, I'd love to discuss your online visibility! We help businesses rank not only on Google Search but also become discoverable on AI tools. Shall I send packages?",
  "Hello http://dslrsnap.com, I wanted to reach out to see if you're open to exploring ways to grow your website traffic and boost online performance. Can I share a proposal?",
  "Hi, Is your business optimized for customers searching through Google, Alexa, and Siri? Our SEO strategies aim to improve Google rankings and drive more organic traffic.",
  "We are a web development agency offering website redesign, app development and digital marketing services at affordable prices. Reply for a free audit.",
  "Get high quality backlinks and guest posts to boost your domain authority. Check https://cheap-links.example and https://more.example today!",
];

// Real customer questions must never be filtered.
const CUSTOMERS = [
  "Hi, my Canon 2000D isn't detected on the Surface Pro 9. The green tick never shows. Any idea?",
  "Can I use DSLR Snap on two laptops at the same wedding? We run two booths most weekends.",
  "I was charged twice for the yearly plan this month, can you check my billing please?",
  "Does the QR gallery work if the venue has no Wi-Fi? Guests at our events often can't get signal.",
  "Is there a way to show my website link on the gallery page so guests can book us? Thinking about SEO for my own booth business too.",
  "Do you offer a discount for a photo booth company with five booths? Happy to pay yearly.",
];

describe("spamScore", () => {
  it.each(PITCHES)("flags a sales pitch: %s", (m) => {
    expect(spamScore(m).spam).toBe(true);
  });

  it.each(CUSTOMERS)("lets a customer question through: %s", (m) => {
    expect(spamScore(m).spam).toBe(false);
  });

  it("explains why a message was flagged", () => {
    expect(spamScore(PITCHES[2]).reasons).toEqual(expect.arrayContaining(["seo"]));
  });
});
