// qa.js <film_dir> [step] : poses the whole film every `step` seconds (default 0.25) with the page-side checks in
// qa_page.js, merges repeated problems into time ranges and writes <film>/qa/scene_report.json. SCENES=a,b limits scenes.
const fs = require('fs'), path = require('path');
const { openFilm } = require('../serve');
const film = path.resolve(process.argv[2] || '.'), step = +(process.argv[3] || 0.25);
process.chdir(film);
(async () => {
  const cal = JSON.parse(fs.readFileSync('calendar.json', 'utf8'));
  const calMap = {}; for (const c of (Array.isArray(cal) ? cal : cal.scenes || [])) if (c.scene || c.name) calMap[c.scene || c.name] = c.chip;
  const F = await openFilm(film, { quiet: true, init: { fn: m => { window.SPEEDS = {}; window.QA_CAL = m; }, arg: calMap } });
  const pg = F.page, errors = F.errors;
  await pg.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'qa_page.js'), 'utf8') });
  const TL = JSON.parse(fs.readFileSync('timeline.json', 'utf8'));
  const only = process.env.SCENES ? new Set(process.env.SCENES.split(',')) : null;
  const raw = [];
  // scripted moves that overlap (a sit before the walk to the seat has finished teleports the figure)
  for (const m of await pg.evaluate(() => window.SCRIPT_WARN || [])) { const t = +(m.match(/at ([\d.]+)/) || [0, 0])[1]; raw.push({ k: 'script', sev: 'fail', msg: m, t, scene: (TL.scenes.find(s => t >= s.start && t < s.end) || {}).name }); }
  for (const it of await pg.evaluate(() => window.QA.speeds())) raw.push({ ...it, scene: (TL.scenes.find(s => it.t >= s.start && it.t < s.end) || {}).name });
  let n = 0;
  for (const s of TL.scenes) {
    if (!s.set || (only && !only.has(s.name))) continue;
    for (let t = s.start + 0.05; t < s.end - 0.05; t += step) {
      let iss; try { iss = await pg.evaluate(t => window.QA.at(t), t); } catch (e) { iss = [{ k: 'error', sev: 'fail', msg: 'QA page error: ' + e.message.split('\n')[0] }]; }
      for (const it of iss) raw.push({ ...it, scene: s.name, t: +t.toFixed(2) });
      if (++n % 200 === 0) process.stdout.write(`qa ${s.name} ${t.toFixed(0)}s\n`);
    }
  }
  // merge: the same message in the same scene within 1 s becomes one range
  const merged = [];
  const keyOf = it => it.scene + '|' + it.k + '|' + it.msg.replace(/[\d.]+ (m\/s|m)/g, '#');
  const open = {};
  for (const it of raw.sort((a, b) => (a.t ?? 0) - (b.t ?? 0))) {
    const k = keyOf(it), o = open[k];
    if (o && it.t - o.t1 <= 1.05) { o.t1 = it.t; o.n++; if (it.sev === 'fail') o.sev = 'fail'; continue; }
    open[k] = { ...it, t0: it.t, t1: it.t, n: 1 }; merged.push(open[k]);
  }
  // off-screen speaking is fine for a moment (reaction shots) but not for most of a line
  const out = merged.filter(m => !(m.k === 'speaker' && m.sev === 'info' && m.t1 - m.t0 < 2.5)).map(m => m.k === 'speaker' && m.sev === 'info' ? { ...m, sev: 'warn' } : m)
    // a one-sample blip of foot slide is noise from a turn-in-place
    .filter(m => !(m.k === 'slide' && m.n < 2 && m.sev === 'warn'));
  for (const e of errors) out.push({ k: 'page', sev: 'fail', who: 'page', msg: e });
  fs.mkdirSync('qa', { recursive: true });
  fs.writeFileSync('qa/scene_report.json', JSON.stringify(out, null, 1));
  const fails = out.filter(m => m.sev === 'fail').length, warns = out.filter(m => m.sev === 'warn').length;
  console.log(`scene QA: ${fails} fail, ${warns} warn (${n} samples)`);
  await F.close();
})().catch(e => { console.error(e); process.exit(1); });
