// Uploads a Windows build to Cloudflare R2 (downloads.dslrsnap.com/win), where booths look for updates
// and the website's /download page finds the newest installer.
//   npm run dist:win         → builds dist/DSLR-Snap-Setup-<version>.exe, .blockmap and latest.yml
//   npm run release          → uploads them (needs R2_* in .env; see .env.example)
// latest.yml goes up last: booths only ever see a release whose installer is already there.
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const root = new URL("..", import.meta.url).pathname;
const env = Object.fromEntries(
  (existsSync(join(root, ".env")) ? readFileSync(join(root, ".env"), "utf8") : "")
    .split("\n")
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const need = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"];
const missing = need.filter((k) => !(process.env[k] || env[k]));
if (missing.length) throw new Error(`Missing in .env: ${missing.join(", ")}`);
const get = (k) => process.env[k] || env[k];

const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const dist = join(root, "dist");
const installer = `DSLR-Snap-Setup-${version}.exe`;
const files = [
  { name: installer, type: "application/vnd.microsoft.portable-executable", cache: "public, max-age=31536000, immutable" },
  { name: `${installer}.blockmap`, type: "application/octet-stream", cache: "public, max-age=31536000, immutable" },
  { name: "latest.yml", type: "text/yaml", cache: "no-cache" }, // last, and never cached
];
for (const f of files) if (!existsSync(join(dist, f.name))) throw new Error(`dist/${f.name} not found: run npm run dist:win first`);
if (!readFileSync(join(dist, "latest.yml"), "utf8").includes(`version: ${version}`)) throw new Error("dist/latest.yml is from another version");

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${get("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: get("R2_ACCESS_KEY_ID"), secretAccessKey: get("R2_SECRET_ACCESS_KEY") },
});
for (const f of files) {
  const path = join(dist, f.name);
  process.stdout.write(`Uploading ${f.name} (${(statSync(path).size / 1048576).toFixed(1)} MB)… `);
  await s3.send(new PutObjectCommand({ Bucket: get("R2_BUCKET"), Key: `win/${f.name}`, Body: readFileSync(path), ContentType: f.type, CacheControl: f.cache }));
  console.log("done");
}
console.log(`\nReleased ${version}. Booths pick it up within 6 hours; the website shows it within the hour.`);
