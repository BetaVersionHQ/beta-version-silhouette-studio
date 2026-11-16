// probe_events.js <film_dir> : poses every scripted walk at 30 fps (no drawing) and records each heel strike (a foot
// coming down onto its floor) with the walker, the floor height and the scene -> <film>/events.json for footsteps.
const fs = require('fs'), path = require('path');
const { openFilm } = require('../serve');
const film = path.resolve(process.argv[2] || '.'); process.chdir(film);
(async () => {
  const F = await openFilm(film, { quiet: true }); const pg = F.page;
  const TL = JSON.parse(fs.readFileSync('timeline.json', 'utf8'));
  // walk windows per scene, from the actors of every loaded set (stage.actors are keyed by script name)
  const wins = await pg.evaluate(() => {
    const out = []; const seen = new Set();
    for (const s of window.TL.scenes) {
      if (!s.set) continue; window.NORENDER = 1; window.renderAt(s.start + 0.1); const L = window.LAST; if (!L) continue;
      const st = L.scene.userData.stage; if (!st || seen.has(st)) continue; seen.add(st);
      for (const a of Object.values(st.actors)) for (const g of a.segs) if (g.k === 'walk') out.push([g.t0, g.t1]);
    }
    return out;
  });
  const times = new Set();
  for (const [a, c] of wins) for (let t = Math.floor(a * 30) / 30; t <= c + 0.2; t += 1 / 30) times.add(+t.toFixed(4));
  const list = [...times].sort((x, y) => x - y);
  const ev = await pg.evaluate(list => {
    const V = (x, y, z) => new window.THREE.Vector3(x, y, z); const prev = {}; const out = [];
    for (const t of list) {
      window.NORENDER = 1; window.renderAt(t); const L = window.LAST; if (!L) continue;
      const scene = window.sceneAt(t).name, st = L.scene.userData.stage;
      for (const [n, f] of Object.entries(L.figs || {})) {
        if (!f.g.visible) continue; f.g.updateMatrixWorld(true);
        let a = null; if (st) for (const x of Object.values(st.actors)) if (x.f === f && x._t === t && x.cur) a = x;
        if (!a || !a.cur.walking) { delete prev[scene + n]; continue; }
        const fl = a.floorAt ? a.floorAt(a.cur.x, a.cur.z) : 0;
        const ys = [f.legL, f.legR].map(l => l.foot.localToWorld(V(0, 0, 0)).y - 0.055 * f.s - fl);
        const p = prev[scene + n];
        if (p) for (let i = 0; i < 2; i++) if (p[i] > 0.012 && ys[i] <= 0.012) out.push({ t: +t.toFixed(3), who: n, scene, x: +a.cur.x.toFixed(2), z: +a.cur.z.toFixed(2), floor: +fl.toFixed(2), run: !!a.cur.run, foot: i });
        prev[scene + n] = ys;
      }
    }
    return out;
  }, list);
  fs.writeFileSync('events.json', JSON.stringify({ steps: ev }, null, 0));
  console.log('steps', ev.length, 'from', wins.length, 'walks');
  await F.close();
})().catch(e => { console.error(e); process.exit(1); });
