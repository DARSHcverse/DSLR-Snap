import { describe, expect, it } from "vitest";
import { contrast, designVars, DEFAULT_DESIGN, parseDesign, PRESETS } from "./design";

describe("gallery design", () => {
  it("derives the full palette from three colours", () => {
    const v = designVars({ ...DEFAULT_DESIGN, bg: "#ffffff", text: "#111111", accent: "#1f7a5c" });
    expect(v["--color-bg"]).toBe("#ffffff");
    expect(v["--color-fg"]).toBe("#111111");
    expect(v["--color-surface"]).not.toBe("#ffffff"); // a card shade, slightly towards the text colour
    expect(v["--color-accent-ink"]).toBe("#ffffff"); // white reads better on dark green
    expect(designVars({ ...DEFAULT_DESIGN, accent: "#f5d76e" })["--color-accent-ink"]).toBe("#111111"); // dark on yellow
  });

  it("measures contrast like WCAG", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrast("#777777", "#888888")).toBeLessThan(1.5);
  });

  it("only accepts real colours, known fonts and the operator's own image paths", () => {
    const d = parseDesign({ bg: "#FFF", text: "red", accent: "#123456", font: "comic", banner: "u1/brand/x.jpg" }, "u1");
    expect(d.bg).toBe("#ffffff");
    expect(d.text).toBe(DEFAULT_DESIGN.text); // "red" isn't a hex colour
    expect(d.accent).toBe("#123456");
    expect(d.font).toBe("sans");
    expect(d.banner).toBe("u1/brand/x.jpg");
    expect(parseDesign({ banner: "someone-else/brand/x.jpg" }, "u1").banner).toBeUndefined();
    expect(parseDesign({ banner: "u1/brand/../../x.jpg" }, "u1").banner).toBeUndefined();
    expect(parseDesign(null, "u1")).toEqual(DEFAULT_DESIGN);
  });

  it("ships readable presets", () => {
    for (const p of PRESETS) expect(contrast(p.design.text, p.design.bg)).toBeGreaterThanOrEqual(4.5);
  });
});
