// render_frames.js <film_dir> <out_dir> [t1,t2,...] : draws single frames as JPEGs (QA sheets, snapshots, camera tests).
// With a time list: t<time>.jpg per time. Without: S0 (first frame) and N (count) env give f%05d.jpg at 30 fps.
// DBG='{"pos":[x,y,z],"look":[x,y,z],"fov":30}' renders a candidate camera instead of the shot's.
const fs = require('fs'), path = require('path');
const { openFilm, glName } = require('./serve');
const [film, out, tl] = process.argv.slice(2);
if (!film || !out) { console.log('usage: node render_frames.js <film_dir> <out_dir> [t1,t2,...]'); process.exit(2); }
(async () => {
  const F = await openFilm(film, { console: !!process.env.VERBOSE });
  console.log('renderer:', F.how, '|', await glName(F.page));
  if (process.env.DBG) await F.page.evaluate(d => { window.DBG = JSON.parse(d); }, process.env.DBG);
  if (process.env.CAMLOG) await F.page.evaluate(() => { window.CAMLOG = 1; });
  fs.mkdirSync(out, { recursive: true });
  const times = tl ? tl.split(',').map(Number) : null, S0 = +(process.env.S0 || 0);
  const list = times || Array.from({ length: +(process.env.N || 300) }, (_, i) => (i + S0) / 30);
  for (let i = 0; i < list.length; i++) {
    await F.page.evaluate(t => window.renderAt(t), list[i]);
    await F.page.screenshot({ path: path.join(out, (times ? 't' + list[i].toFixed(2) : 'f' + String(i + S0).padStart(5, '0')) + '.jpg'), type: 'jpeg', quality: 92 });
  }
  console.log('frames', list.length, '->', out);
  await F.close();
})().catch(e => { console.error(e); process.exit(1); });
