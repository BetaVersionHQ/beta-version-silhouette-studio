// Shared by every page runner (render, QA, footsteps, snapshots): a static server for one film folder and a browser
// launcher that follows the machine tier (kit/tier.json, or the TIER environment variable).
//   film folder first, then the engine (index.html, js/core|stage|act|main|brand|props.js), then kit/sets (world modules),
//   node_modules and brand/ from the engine.
const http = require('http'), fs = require('fs'), path = require('path');
const ENGINE = __dirname, KIT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

function resolve(film, u) {
  const rel = u.replace(/^\/+/, '');
  if (rel.includes('..')) return null;
  const cands = [path.join(film, rel)];
  if (rel === '' || rel === 'index.html') cands.push(path.join(ENGINE, 'index.html'));
  if (rel.startsWith('js/')) cands.push(path.join(ENGINE, rel), path.join(KIT, 'sets', rel.slice(3)));
  if (rel.startsWith('node_modules/') || rel.startsWith('brand/')) cands.push(path.join(ENGINE, rel));
  return cands.find(p => fs.existsSync(p) && fs.statSync(p).isFile()) || null;
}
function startServer(film, port) {
  film = path.resolve(film);
  const srv = http.createServer((q, r) => {
    const p = resolve(film, decodeURIComponent(q.url.split('?')[0]));
    if (!p) { r.writeHead(404); return r.end(); }
    fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); r.end(d); });
  });
  return new Promise(res => srv.listen(port || 0, '127.0.0.1', () => res({ srv, port: srv.address().port })));
}
function filmInfo(film) {
  const f = JSON.parse(fs.readFileSync(path.join(film, 'film.json'), 'utf8'));
  const short = f.format === 'short';
  return { film: f, format: short ? 'short' : 'long', width: short ? 720 : 1280, height: short ? 1280 : 720 };
}
function tier() {
  if (process.env.TIER) return process.env.TIER.toUpperCase();
  try { return JSON.parse(fs.readFileSync(path.join(KIT, 'tier.json'), 'utf8')).tier || 'CPU'; } catch (e) { return 'CPU'; }
}
// GPU / ANYGPU: the installed Chrome (or Edge) with GPU flags. CPU: Playwright's own headless shell with SwiftShader.
const SWIFT = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const GPU = ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--force_high_performance_gpu', '--enable-webgl'];
async function launch(opts = {}) {
  const { chromium } = require('playwright');
  const t = opts.tier || tier();
  if (t !== 'CPU') {
    const order = process.env.CHANNEL ? [process.env.CHANNEL] : process.platform === 'win32' ? ['chrome', 'msedge'] : ['chrome', 'msedge'];
    for (const channel of order) {
      try { const b = await chromium.launch({ channel, args: GPU }); return { browser: b, how: `${t} ${channel}` }; }
      catch (e) { if (!opts.quiet) console.log(`(${channel} not available: ${String(e.message).split('\n')[0]})`); }
    }
    console.log('no Chrome or Edge found: falling back to the CPU renderer (SwiftShader)');
  }
  return { browser: await chromium.launch({ args: SWIFT }), how: 'CPU swiftshader' };
}
async function openFilm(film, opts = {}) {
  const info = filmInfo(film), { srv, port } = await startServer(film, opts.port);
  const { browser, how } = await launch(opts);
  // SS_SCALE=1.5 draws the same 1280x720 layout at 1920x1080 (sharper footage; QA always runs at 1)
  const page = await browser.newPage({ viewport: { width: info.width, height: info.height }, deviceScaleFactor: +process.env.SS_SCALE || 1 });
  const errors = [];
  page.on('pageerror', e => { errors.push(e.message); if (!opts.quiet) console.log('pageerror:', e.message); });
  page.on('console', m => { const x = m.text(); if (/module failed|Error/.test(x)) errors.push(x); if (opts.console && m.type() !== 'warning') console.log('console:', x); });
  if (opts.init) await page.addInitScript(opts.init.fn, opts.init.arg);
  await page.goto(`http://127.0.0.1:${port}/index.html${opts.qs ? '?' + opts.qs : ''}`);
  await page.waitForFunction('window.READY === true', null, { timeout: 180000 });
  const close = async () => { await browser.close(); srv.close(); };
  return { page, browser, srv, info, how, errors, close };
}
async function glName(page) {
  return page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); if (!g) return 'no webgl2'; const x = g.getExtension('WEBGL_debug_renderer_info'); return x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); });
}
module.exports = { startServer, filmInfo, tier, launch, openFilm, glName, ENGINE, KIT };
// node serve.js --probe [GPU|ANYGPU|CPU] : prints "how | WebGL renderer" (setup.py uses it to confirm the tier).
if (require.main === module && process.argv[2] === '--probe') {
  (async () => {
    const { browser, how } = await launch({ tier: (process.argv[3] || 'GPU').toUpperCase(), quiet: true });
    const page = await browser.newPage(); console.log(how + ' | ' + await glName(page)); await browser.close();
  })().catch(e => { console.log('probe failed: ' + String(e.message).split('\n')[0]); process.exit(1); });
}
