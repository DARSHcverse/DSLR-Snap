/**
 * A gallery's look: three colours, a font and optional images (banner, logo, background). The rest of
 * the palette (cards, lines, muted text, text on the accent) is derived, so any choice stays coherent.
 * Pure, so the editor's live preview, the pages and the tests share it.
 */
export interface Design {
  bg: string;
  text: string;
  accent: string;
  font: "sans" | "serif";
  /** Storage paths of the operator's own images ("<userId>/brand/…"). */
  banner?: string;
  logo?: string;
  background?: string;
}

export const DEFAULT_DESIGN: Design = { bg: "#0b0b0f", text: "#f4f2ee", accent: "#ff7a59", font: "sans" };

export const PRESETS: { name: string; design: Design }[] = [
  { name: "DSLR Snap", design: DEFAULT_DESIGN },
  { name: "Classic white", design: { bg: "#ffffff", text: "#16161d", accent: "#16161d", font: "sans" } },
  { name: "Wedding blush", design: { bg: "#fbf3ef", text: "#3b2a28", accent: "#b76e79", font: "serif" } },
  { name: "Emerald", design: { bg: "#0f3d33", text: "#f3f7f4", accent: "#e8c66a", font: "serif" } },
  { name: "Navy & gold", design: { bg: "#0f1b33", text: "#f5f1e6", accent: "#d4a843", font: "serif" } },
  { name: "Party", design: { bg: "#140a26", text: "#f7f2ff", accent: "#ff4fb1", font: "sans" } },
];

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function normalHex(v: unknown): string | null {
  if (typeof v !== "string" || !HEX.test(v.trim())) return null;
  const h = v.trim().toLowerCase();
  return h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h;
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c: number[]) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
/** a → b by t (0…1). */
const mix = (a: string, b: string, t: number) => toHex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * t));

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio (1…21). 4.5 is the bar for body text. */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** The site's colour variables for this design, so every existing style follows it. */
export function designVars(d: Design): Record<string, string> {
  const light = luminance(d.bg) > 0.4;
  return {
    "--color-bg": d.bg,
    "--color-fg": d.text,
    "--color-surface": mix(d.bg, d.text, 0.06),
    "--color-surface-2": mix(d.bg, d.text, 0.11),
    "--color-line": mix(d.bg, d.text, 0.18),
    "--color-muted": mix(d.text, d.bg, 0.38),
    "--color-accent": d.accent,
    "--color-accent-ink": contrast("#ffffff", d.accent) >= contrast("#111111", d.accent) ? "#ffffff" : "#111111",
    "--color-booth-glow": mix(d.bg, d.accent, light ? 0.08 : 0.14),
    "--font-display": d.font === "serif" ? 'Georgia, "Times New Roman", serif' : "var(--font-sans)",
  };
}

const ownImage = (v: unknown, userId: string) =>
  typeof v === "string" && v.startsWith(`${userId}/brand/`) && /^[\w-]+\/brand\/[\w-]+\.(jpg|png|webp)$/.test(v) ? v : undefined;

/** A design from stored or submitted JSON: anything unknown falls back to the default. */
export function parseDesign(raw: unknown, userId: string): Design {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d: Design = {
    bg: normalHex(r.bg) ?? DEFAULT_DESIGN.bg,
    text: normalHex(r.text) ?? DEFAULT_DESIGN.text,
    accent: normalHex(r.accent) ?? DEFAULT_DESIGN.accent,
    font: r.font === "serif" ? "serif" : "sans",
  };
  for (const k of ["banner", "logo", "background"] as const) {
    const p = ownImage(r[k], userId);
    if (p) d[k] = p;
  }
  return d;
}
