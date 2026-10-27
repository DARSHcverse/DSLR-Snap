import { describe, expect, it } from "vitest";
import { describeFiles, isExpired, isShareToken, makeShareToken, parseUploadRequest, storagePath } from "./gallery";

const SESSION = "6f1c2a4e-8a0b-4c7e-9d3f-1b2c3d4e5f60";
const EVENT = "0b9a8c7d-6e5f-4a3b-8c2d-1e0f9a8b7c6d";
const good = {
  sessionId: SESSION,
  event: { id: EVENT, name: " Priya & Tom ", date: "2026-10-31" },
  files: [
    { kind: "photo", contentType: "image/jpeg", bytes: 2_000_000 },
    { kind: "gif", contentType: "image/gif", bytes: 900_000 },
  ],
};

describe("parseUploadRequest", () => {
  it("accepts a boomerang alongside the photo", () => {
    expect(parseUploadRequest({ ...good, files: [...good.files, { kind: "boomerang", contentType: "image/gif", bytes: 3_000_000 }] })).not.toHaveProperty("error");
  });

  it("accepts a normal session upload", () => {
    expect(parseUploadRequest(good)).toMatchObject({ sessionId: SESSION, event: { name: "Priya & Tom", date: "2026-10-31" } });
  });

  it("refuses anything odd", () => {
    const bad = [
      { ...good, sessionId: "../../etc" },
      { ...good, event: { ...good.event, id: "x" } },
      { ...good, files: [] },
      { ...good, files: [{ kind: "gif", contentType: "image/gif", bytes: 10 }] }, // no photo
      { ...good, files: [{ kind: "photo", contentType: "text/html", bytes: 10 }] },
      { ...good, files: [{ kind: "photo", contentType: "image/jpeg", bytes: 26 * 1024 * 1024 }] },
      { ...good, files: [good.files[0], good.files[0]] },
      { ...good, files: [{ kind: "exe", contentType: "image/jpeg", bytes: 10 }] },
    ];
    for (const b of bad) expect(parseUploadRequest(b as never)).toHaveProperty("error");
    expect(parseUploadRequest(null)).toHaveProperty("error");
  });
});

describe("gallery helpers", () => {
  it("builds per-owner storage paths", () => {
    expect(storagePath("u1", "e1", SESSION, "colour")).toBe(`u1/e1/${SESSION}/colour.jpg`);
  });

  it("makes unguessable share tokens", () => {
    const a = makeShareToken();
    expect(isShareToken(a)).toBe(true);
    expect(a).not.toBe(makeShareToken());
    expect(isShareToken("short")).toBe(false);
  });

  it("expires galleries after a year", () => {
    const now = Date.UTC(2027, 10, 1);
    expect(isExpired("2026-10-31T00:00:00Z", now)).toBe(true);
    expect(isExpired("2027-01-01T00:00:00Z", now)).toBe(false);
  });

  it("labels B&W and colour versions for guests", () => {
    const f = (kind: "photo" | "colour" | "gif" | "boomerang") => ({ kind, path: "", contentType: "" });
    expect(describeFiles([f("gif"), f("photo"), f("boomerang"), f("colour")]).map((d) => d.label)).toEqual(["Black & white", "Colour", "Boomerang", "Animated GIF"]);
    expect(describeFiles([f("photo")])[0].label).toBe("Your photo strip");
  });
});
