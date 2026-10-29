"use client";

import { useRouter } from "next/navigation";
import { type CSSProperties, useState } from "react";
import { contrast, type Design, designVars, PRESETS } from "@/lib/design";
import { resetToDefaultDesign, saveDesign, startBrandUpload } from "./designActions";

type ImageKind = "banner" | "logo" | "background";
const IMAGE_LABEL: Record<ImageKind, { label: string; hint: string }> = {
  banner: { label: "Banner", hint: "Wide image across the top (e.g. 1600×500)" },
  logo: { label: "Logo", hint: "Your business logo, PNG with transparency works best" },
  background: { label: "Background", hint: "Shown softly behind the photos" },
};

/** Edit Design: presets, three colours, a font and images, with a live preview using this event's photos. */
export function DesignEditor({ eventId, eventName, initial, images, samples, custom }: {
  eventId: string;
  eventName: string;
  initial: Design;
  images: Partial<Record<ImageKind, string>>;
  samples: string[];
  /** The event has its own design (rather than the account default). */
  custom: boolean;
}) {
  const router = useRouter();
  const [d, setD] = useState<Design>(initial);
  const [previews, setPreviews] = useState(images);
  const [busy, setBusy] = useState<ImageKind | "save" | null>(null);
  const [makeDefault, setMakeDefault] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const readable = contrast(d.text, d.bg);

  const upload = async (kind: ImageKind, file: File) => {
    setBusy(kind);
    setMsg(null);
    try {
      const start = await startBrandUpload(eventId, file.type, file.size);
      if ("error" in start) throw new Error(start.error);
      const res = await fetch(start.url, { method: "PUT", body: file, headers: { ...start.headers, "content-type": file.type, "x-upsert": "true" } });
      if (!res.ok) throw new Error(`Upload failed (${res.status}).`);
      setD((x) => ({ ...x, [kind]: start.path }));
      setPreviews((p) => ({ ...p, [kind]: URL.createObjectURL(file) }));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy("save");
    const r = await saveDesign(eventId, JSON.stringify(d), makeDefault);
    setBusy(null);
    setMsg("error" in r ? r.error : makeDefault ? "Saved, and new events will start with this look." : "Saved. The gallery uses this look now.");
    router.refresh();
  };

  const colour = (key: "bg" | "text" | "accent", label: string) => (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted">{d[key]}</span>
        <input type="color" value={d[key]} onChange={(e) => setD({ ...d, [key]: e.target.value })} className="h-8 w-10 cursor-pointer rounded border border-line bg-transparent" />
      </span>
    </label>
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm text-muted">Start from a look</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => setD((x) => ({ ...x, ...p.design, banner: x.banner, logo: x.logo, background: x.background }))}
                className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs hover:bg-surface-2"
              >
                <span className="flex">
                  {[p.design.bg, p.design.accent].map((c) => <span key={c} className="size-3 rounded-full border border-line" style={{ background: c }} />)}
                </span>
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
          {colour("bg", "Background")}
          {colour("text", "Text")}
          {colour("accent", "Accent (buttons)")}
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted">Headings</span>
            <select value={d.font} onChange={(e) => setD({ ...d, font: e.target.value === "serif" ? "serif" : "sans" })} className="rounded-lg border border-line bg-bg px-2 py-1">
              <option value="sans">Modern</option>
              <option value="serif">Elegant (serif)</option>
            </select>
          </label>
          {readable < 4.5 && <p className="text-xs text-bad">Text may be hard to read on this background (contrast {readable.toFixed(1)}:1, aim for 4.5).</p>}
        </div>
        {(["banner", "logo", "background"] as const).map((k) => (
          <div key={k} className="rounded-xl border border-line p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span>
                <span className="block font-medium">{IMAGE_LABEL[k].label}</span>
                <span className="block text-xs text-muted">{IMAGE_LABEL[k].hint}</span>
              </span>
              {d[k] ? (
                <button type="button" className="text-xs text-bad hover:underline" onClick={() => setD((x) => ({ ...x, [k]: undefined }))}>Remove</button>
              ) : null}
            </div>
            <label className="mt-2 inline-block cursor-pointer rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-surface-2">
              {busy === k ? "Uploading…" : d[k] ? "Replace" : "Upload"}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={!!busy} onChange={(e) => e.target.files?.[0] && upload(k, e.target.files[0])} />
            </label>
          </div>
        ))}
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} className="accent-[var(--color-accent)]" />
          Use as my default look for new events
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={save} disabled={!!busy} className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-50">{busy === "save" ? "Saving…" : "Save design"}</button>
          {custom && (
            <button type="button" className="text-xs text-muted hover:text-fg" onClick={async () => (await resetToDefaultDesign(eventId), router.refresh())}>
              Use my default look instead
            </button>
          )}
        </div>
        {msg && <p className="text-sm text-muted">{msg}</p>}
      </div>

      {/* Live preview: the real gallery styles, scaled down. */}
      <div className="overflow-hidden rounded-card border border-line">
        <div style={designVars(d) as CSSProperties} className="relative bg-[var(--color-bg)] text-[var(--color-fg)]">
          {d.background && previews.background && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- preview */}
              <img src={previews.background} alt="" className="absolute inset-0 size-full object-cover" />
              <div className="absolute inset-0 bg-[var(--color-bg)] opacity-80" />
            </>
          )}
          <div className="relative">
            {d.banner && previews.banner && (
              // eslint-disable-next-line @next/next/no-img-element -- preview
              <img src={previews.banner} alt="" className="max-h-40 w-full object-cover" />
            )}
            {d.logo && previews.logo && (
              <div className={`flex justify-center ${d.banner ? "-mt-8" : "pt-6"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- preview */}
                <img src={previews.logo} alt="" className="max-h-16 max-w-[160px] rounded-xl bg-[var(--color-bg)] object-contain p-1.5 shadow" />
              </div>
            )}
            <div className="px-5 py-6 text-center">
              <p className="text-[10px] font-semibold tracking-[0.2em] text-[var(--color-accent)] uppercase">Photo booth gallery</p>
              <p className="mt-1 font-display text-2xl font-bold">{eventName}</p>
              <span className="mt-3 inline-block rounded-full bg-[var(--color-accent)] px-4 py-1.5 text-xs font-semibold text-[var(--color-accent-ink)]">Download all</span>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {(samples.length ? samples : Array.from({ length: 6 }, () => "")).slice(0, 6).map((src, i) =>
                  src ? (
                    // eslint-disable-next-line @next/next/no-img-element -- preview
                    <img key={i} src={src} alt="" className="aspect-[2/3] w-full rounded-lg border border-[var(--color-line)] object-cover" />
                  ) : (
                    <div key={i} className="aspect-[2/3] rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)]" />
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
