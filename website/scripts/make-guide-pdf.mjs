// Makes public/dslr-snap-user-guide.pdf from the /guide page, using the print styles in globals.css.
// Run against a running build of the site:  node scripts/make-guide-pdf.mjs http://localhost:3000
// Needs a Chrome started with --remote-debugging-port=9222 (headless is fine).
import { writeFileSync } from "node:fs";

const site = process.argv[2] ?? "http://localhost:3000";
const debug = process.env.CHROME_DEBUG_URL ?? "http://127.0.0.1:9222";
const tab = (await (await fetch(`${debug}/json`)).json()).find((t) => t.type === "page");
const ws = new WebSocket(tab.webSocketDebuggerUrl);
let id = 0;
const waiting = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  waiting.get(d.id)?.(d);
};
await new Promise((r) => (ws.onopen = r));
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    waiting.set(++id, (d) => (d.error ? reject(new Error(d.error.message)) : resolve(d.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });

await send("Page.navigate", { url: `${site}/guide` });
await new Promise((r) => setTimeout(r, 4000));
const { data } = await send("Page.printToPDF", {
  paperWidth: 8.27, // A4
  paperHeight: 11.69,
  marginTop: 0.6,
  marginBottom: 0.6,
  marginLeft: 0.6,
  marginRight: 0.6,
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#777">DSLR Snap user guide · dslrsnap.com/guide · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
});
const out = new URL("../public/dslr-snap-user-guide.pdf", import.meta.url);
writeFileSync(out, Buffer.from(data, "base64"));
console.log(`Saved ${out.pathname} (${Math.round(Buffer.from(data, "base64").length / 1024)} KB)`);
ws.close();
