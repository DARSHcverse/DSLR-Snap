import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const alt = site.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "radial-gradient(120% 90% at 50% 0%, #241a2a 0%, #0b0b0f 65%)",
          color: "#f4f2ee",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "#ff7a59" }} />
          <div style={{ fontSize: 40, fontWeight: 700 }}>DSLR Snap</div>
        </div>
        <div style={{ marginTop: 48, fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
          Photo booth software
        </div>
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, color: "#ff7a59" }}>
          for Windows
        </div>
        <div style={{ marginTop: 36, fontSize: 30, color: "#9a98a3" }}>
          Canon DSLR · DNP printing · Works offline
        </div>
      </div>
    ),
    size,
  );
}
