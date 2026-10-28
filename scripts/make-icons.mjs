// Draws every DSLR Snap icon from the vector mark, so each size is crisp rather than shrunk from one PNG.
//   node scripts/make-icons.mjs
// Writes:
//   resources/icon.png             1024 px, used by the installer on macOS/Linux and the dev window
//   resources/icon.ico             Windows app + installer: 16–256 px; 16–32 px drop the flash marks
//   website/src/app/favicon.ico    16/32/48 px for browsers and Google
//   website/src/app/icon.svg       the browser tab icon (vector)
//   website/src/app/apple-icon.png 180 px, full-bleed for iPhone home screens
//   website/public/email/logo-icon.png  128 px for email signatures
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const ORANGE = "#FF7A59";
const INK = "#1A0D08";

// The aperture, centred on (0,0): a dark disc with a hexagonal opening and six blade edges.
const aperture = (r = 27) => {
  const k = r / 27; // blade geometry was drawn for r = 27
  const pts = [[6.75, -11.69], [13.5, 0], [6.75, 11.69], [-6.75, 11.69], [-13.5, 0], [-6.75, -11.69]].map(([x, y]) => `${x * k},${y * k}`).join(" ");
  const blades = [
    [13.5, 0, -13.25, -46.33],
    [6.75, 11.69, 33.5, -34.64],
    [-6.75, 11.69, 46.75, 11.69],
    [-13.5, 0, 13.25, 46.33],
    [-6.75, -11.69, -33.5, 34.64],
    [6.75, -11.69, -46.75, -11.69],
  ]
    .map(([x1, y1, x2, y2]) => `<line x1="${x1 * k}" y1="${y1 * k}" x2="${x2 * k}" y2="${y2 * k}"/>`)
    .join("");
  return `<clipPath id="ap"><circle r="${r}"/></clipPath>
<g clip-path="url(#ap)"><circle r="${r}" fill="${INK}"/><polygon points="${pts}" fill="${ORANGE}"/>
<g stroke="${ORANGE}" stroke-width="${2.6 * k}" stroke-linecap="butt">${blades}</g></g>`;
};

// Rounded square 72×72 at (0,0) with the aperture centred in it (the original drew it 8 units right of centre).
const square = `<rect width="72" height="72" rx="20" fill="${ORANGE}"/><g transform="translate(36 36)">${aperture()}</g>`;
// Flash marks, in the same place relative to the square as the original logo.
const flash = `<g stroke="${ORANGE}" stroke-width="4.2" stroke-linecap="round">
<line x1="74.5" y1="-10" x2="73" y2="-1.5"/><line x1="80" y1="1" x2="87" y2="-4.5"/><line x1="79.5" y1="9" x2="89" y2="9"/></g>`;

const svg = (viewBox, body, size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${size ? ` width="${size}" height="${size}"` : ""}>${body}</svg>`;

// Full mark: content spans x −2…91, y −12…72, centred in a 96-unit square.
const full = (size) => svg("-2.5 -18 96 96", square + flash, size);
// Small sizes: the square alone, edge to edge with a hairline margin, so 16 px stays readable.
const simple = (size) => svg("-2 -2 76 76", square, size);
// iPhone home screen: the system rounds the corners, so fill the canvas and let the aperture breathe.
const apple = (size) => svg("0 0 100 100", `<rect width="100" height="100" fill="${ORANGE}"/><g transform="translate(50 50)">${aperture(31)}</g>`, size);

// Rendered at 4× (the SVG says its own pixel size) and scaled down: smooth edges at every size.
const png = (svgText, size) => sharp(Buffer.from(svgText), { density: 72 * 4 }).resize(size, size).png().toBuffer();

/** A Windows .ico: 256 px stored as PNG, smaller sizes as 32-bit bitmaps (what every Windows tool accepts). */
async function ico(entries) {
  const images = [];
  for (const { size, svgText } of entries) {
    const pngBuf = await png(svgText, size);
    if (size >= 256) {
      images.push({ size, data: pngBuf });
      continue;
    }
    const { data } = await sharp(pngBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const maskRow = Math.ceil(size / 32) * 4;
    const dib = Buffer.alloc(40 + size * size * 4 + maskRow * size);
    dib.writeUInt32LE(40, 0); // BITMAPINFOHEADER
    dib.writeInt32LE(size, 4);
    dib.writeInt32LE(size * 2, 8); // colour + mask
    dib.writeUInt16LE(1, 12);
    dib.writeUInt16LE(32, 14);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const s = (y * size + x) * 4;
        const d = 40 + ((size - 1 - y) * size + x) * 4; // bottom-up rows, BGRA
        dib[d] = data[s + 2];
        dib[d + 1] = data[s + 1];
        dib[d + 2] = data[s];
        dib[d + 3] = data[s + 3];
      }
    }
    images.push({ size, data: dib }); // AND mask left all-zero: the alpha channel does the work
  }
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // icon
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach((img, i) => {
    const e = 6 + i * 16;
    header.writeUInt8(img.size >= 256 ? 0 : img.size, e);
    header.writeUInt8(img.size >= 256 ? 0 : img.size, e + 1);
    header.writeUInt16LE(1, e + 4); // planes
    header.writeUInt16LE(32, e + 6); // bits per pixel
    header.writeUInt32LE(img.data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += img.data.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.data)]);
}

const pick = (size) => (size <= 32 ? simple(size) : full(size));
const out = {
  "resources/icon.png": await png(full(1024), 1024),
  "resources/icon.ico": await ico([16, 20, 24, 32, 40, 48, 64, 128, 256].map((size) => ({ size, svgText: pick(size) }))),
  "website/src/app/favicon.ico": await ico([16, 32, 48].map((size) => ({ size, svgText: pick(size) }))),
  "website/src/app/icon.svg": Buffer.from(full() + "\n"),
  "website/src/app/apple-icon.png": await png(apple(180), 180),
  "website/public/email/logo-icon.png": await png(simple(128), 128),
  "brand/logo-icon.svg": Buffer.from(full() + "\n"),
  "brand/logo-icon-1024.png": await png(full(1024), 1024),
};
for (const [path, buf] of Object.entries(out)) {
  writeFileSync(path, buf);
  console.log(`${path.padEnd(36)} ${(buf.length / 1024).toFixed(1)} KB`);
}
