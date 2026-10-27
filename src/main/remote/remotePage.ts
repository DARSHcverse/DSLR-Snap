/**
 * The phone remote page: one self-contained HTML file (no internet needed, so it works on a venue
 * hotspot). It polls ./status and posts to ./action relative to its own secret URL.
 * All server text is inserted with textContent, never as HTML.
 */
export function remotePage(): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0b0b0f"><title>DSLR Snap remote</title>
<style>
  :root { --bg:#0b0b0f; --surface:#16161d; --surface2:#20202a; --line:#2c2c38; --text:#f4f2ee; --muted:#9a98a3; --accent:#ff7a59; --ink:#1a0d08; --ok:#3ccf8e; --busy:#f5b942; --bad:#ff5d6c; color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif; padding: 16px 16px calc(24px + env(safe-area-inset-bottom)); }
  h1 { font-size: 13px; letter-spacing: .2em; text-transform: uppercase; color: var(--accent); margin: 4px 0 2px; }
  h2 { font-size: 26px; margin: 0 0 14px; }
  h3 { font-size: 15px; margin: 22px 0 8px; color: var(--muted); font-weight: 600; }
  .grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
  .card { overflow-wrap: anywhere; }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; }
  .big { font-size: 30px; font-weight: 700; line-height: 1.1; }
  .muted { color: var(--muted); font-size: 13px; }
  .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; background: var(--muted); }
  .ok { background: var(--ok); } .busy { background: var(--busy); } .bad { background: var(--bad); }
  button { font: inherit; font-weight: 600; border: 1px solid var(--line); background: var(--surface2); color: var(--text); border-radius: 999px; padding: 10px 16px; min-height: 44px; }
  button.primary { background: var(--accent); color: var(--ink); border-color: transparent; width: 100%; font-size: 18px; padding: 14px; }
  button.paused { background: var(--busy); color: #1c1203; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--line); }
  .row:last-child { border-bottom: 0; }
  .thumbs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .thumbs figure { margin: 0; display: flex; flex-direction: column; gap: 6px; }
  .thumbs img { width: 100%; aspect-ratio: 2/3; object-fit: cover; border-radius: 8px; background: var(--surface2); }
  .thumbs button { padding: 6px; min-height: 36px; font-size: 13px; }
  #offline { display: none; background: var(--bad); color: #1d0508; border-radius: 10px; padding: 8px 12px; margin-bottom: 12px; font-weight: 600; }
  #toast { position: fixed; left: 16px; right: 16px; bottom: calc(16px + env(safe-area-inset-bottom)); background: var(--surface2); border: 1px solid var(--line); border-radius: 12px; padding: 12px; text-align: center; opacity: 0; transition: opacity .2s; pointer-events: none; }
</style></head>
<body>
  <div id="offline">Can't reach the booth. Is this phone on the same Wi-Fi?</div>
  <h1>DSLR Snap remote</h1>
  <h2 id="event">…</h2>
  <button id="pause" class="primary">Pause booth</button>
  <div class="grid" style="margin-top:12px">
    <div class="card"><div class="muted">Guests</div><div class="big" id="guests">–</div></div>
    <div class="card"><div class="muted">Prints</div><div class="big" id="prints">–</div></div>
    <div class="card"><div class="muted"><span class="dot" id="camDot"></span>Camera</div><div id="cam">–</div></div>
    <div class="card"><div class="muted"><span class="dot" id="prnDot"></span>Printer</div><div id="prn">–</div></div>
  </div>
  <div class="card" style="margin-top:10px"><div class="muted">Paper</div><div id="paper">Not counted (record a roll in the app)</div></div>
  <div id="failedWrap" style="display:none"><h3>Failed prints</h3><div class="card" id="failed"></div></div>
  <h3>Latest sessions</h3>
  <div class="thumbs" id="recent"></div>
  <div id="toast"></div>
<script>
  const base = location.pathname.replace(/\\/$/, '');
  const $ = (id) => document.getElementById(id);
  const state = { paused: false, recentIds: null };
  const cls = (s) => s === 'ready' ? 'ok' : s === 'busy' || s === 'connecting' ? 'busy' : 'bad';
  const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.style.opacity = 1; clearTimeout(t._h); t._h = setTimeout(() => t.style.opacity = 0, 2200); }
  async function act(body, done) {
    try {
      const r = await fetch(base + '/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Failed');
      toast(done); refresh();
    } catch (e) { toast(e.message); }
  }
  $('pause').onclick = () => act({ action: state.paused ? 'resume' : 'pause' }, state.paused ? 'Booth resumed' : 'Booth paused');
  async function refresh() {
    try {
      const s = await (await fetch(base + '/status', { cache: 'no-store' })).json();
      $('offline').style.display = 'none';
      $('event').textContent = s.eventName || 'No event selected';
      state.paused = s.paused;
      $('pause').textContent = s.paused ? 'Resume booth' : 'Pause booth';
      $('pause').className = 'primary' + (s.paused ? ' paused' : '');
      $('guests').textContent = s.guests; $('prints').textContent = s.prints;
      $('camDot').className = 'dot ' + cls(s.camera.state); $('cam').textContent = s.camera.detail || s.camera.state;
      $('prnDot').className = 'dot ' + cls(s.printer.state);
      $('prn').textContent = (s.printer.detail || s.printer.state) + (s.printer.waiting ? ' · ' + s.printer.waiting + ' waiting' : '');
      if (s.paper) $('paper').textContent = s.paper.remaining + ' of ' + s.paper.capacity + ' prints left' + (s.paper.remaining <= 50 ? ' (running low)' : '');
      const f = $('failed'); f.replaceChildren();
      $('failedWrap').style.display = s.failedJobs.length ? '' : 'none';
      for (const j of s.failedJobs) {
        const row = document.createElement('div'); row.className = 'row';
        const txt = document.createElement('div'); txt.textContent = time(j.at) + (j.error ? ' · ' + j.error : '');
        const b = document.createElement('button'); b.textContent = 'Retry'; b.onclick = () => act({ action: 'retry', jobId: j.id }, 'Retrying print');
        row.append(txt, b); f.append(row);
      }
      const ids = s.recent.map((r) => r.id).join();
      if (ids !== state.recentIds) {
        state.recentIds = ids;
        const box = $('recent'); box.replaceChildren();
        for (const r of s.recent) {
          const fig = document.createElement('figure');
          const img = document.createElement('img'); img.loading = 'lazy'; img.alt = ''; img.src = base + '/thumb/' + r.id;
          const b = document.createElement('button'); b.textContent = 'Reprint ' + time(r.at);
          b.onclick = () => confirm('Reprint this session?') && act({ action: 'reprint', sessionId: r.id }, 'Reprint queued');
          fig.append(img, b); box.append(fig);
        }
        if (!s.recent.length) { const p = document.createElement('p'); p.className = 'muted'; p.style.gridColumn = '1 / -1'; p.textContent = 'No sessions yet.'; box.append(p); }
      }
    } catch { $('offline').style.display = 'block'; }
  }
  refresh(); setInterval(refresh, 3000);
</script>
</body></html>`
}
