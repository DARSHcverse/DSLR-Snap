import { describe, expect, it } from "vitest";
import { cleanPresets } from "./appSettings";

describe("cleanPresets", () => {
  it("keeps valid presets and only exposure values", () => {
    expect(cleanPresets([{ id: "my-1", name: " Speedlite  ballroom ", settings: { iso: "400", shutter: "1/125", whiteBalance: "Flash", junk: "x" } }])).toEqual([
      { id: "my-1", name: "Speedlite ballroom", settings: { iso: "400", shutter: "1/125", whiteBalance: "Flash" } },
    ]);
  });
  it("drops bad entries, duplicate names and odd values, and keeps 12", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, settings: {} }));
    expect(cleanPresets(many)).toHaveLength(12);
    expect(cleanPresets([null, { id: "x y!", name: "A", settings: {} }, { id: "a", name: "", settings: {} }, { id: "b", name: "Same", settings: { iso: "<script>" } }, { id: "c", name: "same", settings: {} }])).toEqual([
      { id: "b", name: "Same", settings: {} },
    ]);
    expect(cleanPresets("nope")).toBeNull();
  });
});
