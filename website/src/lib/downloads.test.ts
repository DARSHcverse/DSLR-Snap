import { describe, expect, it } from "vitest";
import { parseLatestYml } from "./downloads";

const YML = `version: 0.2.0
files:
  - url: DSLR-Snap-Setup-0.2.0.exe
    sha512: abc==
    size: 187654321
path: DSLR-Snap-Setup-0.2.0.exe
sha512: abc==
releaseDate: '2026-11-02T10:15:00.000Z'
`;

describe("latest.yml from the release folder", () => {
  it("reads the version, installer, size and date", () => {
    expect(parseLatestYml(YML, "https://downloads.dslrsnap.com/win")).toEqual({
      version: "0.2.0",
      url: "https://downloads.dslrsnap.com/win/DSLR-Snap-Setup-0.2.0.exe",
      sizeBytes: 187654321,
      releasedAt: "2026-11-02T10:15:00.000Z",
    });
  });

  it("rejects anything that isn't a release, or points outside the folder", () => {
    expect(parseLatestYml("<html>Not found</html>", "https://x/win")).toBeNull();
    expect(parseLatestYml(YML.replaceAll("DSLR-Snap-Setup-0.2.0.exe", "https://evil.example/x.exe"), "https://x/win")).toBeNull();
    expect(parseLatestYml(YML.replaceAll("DSLR-Snap-Setup-0.2.0.exe", "../x.exe"), "https://x/win")).toBeNull();
  });
});
