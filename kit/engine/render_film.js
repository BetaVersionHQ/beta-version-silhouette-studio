// render_film.js <film_dir> [seconds] : draws every frame at 30 fps and pipes JPEGs into ffmpeg (x264 crf 19) in 30 s
// chunks: <film>/render/chunks/cNNNN.mp4 (resumable: finished chunks are kept) and render/list.txt for the join.
// Called by kit/render.py, which gates on QA, prepares the audio and writes the final mp4.
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const { openFilm, glName } = require('./serve');
const film = path.resolve(process.argv[2] || '.'), secs = process.argv[3] ? +process.argv[3] : null, CH = 900;
const TL = JSON.parse(fs.readFileSync(path.join(film, 'timeline.json'), 'utf8'));
const NF = Math.ceil((secs ? Math.min(secs, TL.end) : TL.end) * 30), NC = Math.ceil(NF / CH);
const dir = path.join(film, 'render', 'chunks'), chunk = c => path.join(dir, 'c' + String(c).padStart(4, '0') + '.mp4');
(async () => {
  fs.mkdirSync(dir, { recursive: true });
  // finished chunks are kept for a resumed render, but only while the frame count and every source (film timeline and js,
  // the engine page and modules) are unchanged; any edit since then starts the chunks over
  const newest = ds => Math.max(0, ...ds.flatMap(d => fs.existsSync(d) ? (fs.statSync(d).isDirectory()
    ? fs.readdirSync(d).map(f => fs.statSync(path.join(d, f)).mtimeMs) : [fs.statSync(d).mtimeMs]) : []));
  const src = newest([path.join(film, 'timeline.json'), path.join(film, 'env.json'), path.join(film, 'film.json'), path.join(film, 'js'),
    path.join(__dirname, 'index.html'), path.join(__dirname, 'js')]);
  const stamp = path.join(film, 'render', 'chunks', 'frames.txt'), want = `${NF} ${Math.round(src)} x${+process.env.SS_SCALE || 1}`;
  if (!fs.existsSync(stamp) || fs.readFileSync(stamp, 'utf8') !== want) { for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f)); fs.writeFileSync(stamp, want); }
  const F = await openFilm(film);
  console.log('renderer:', F.how, '|', await glName(F.page), '|', F.info.width + 'x' + F.info.height);
  const t0 = Date.now(); let done = 0;
  for (let c = 0; c < NC; c++) {
    if (fs.existsSync(chunk(c)) && fs.statSync(chunk(c)).size > 0) continue;
    const s0 = c * CH, n = Math.min(CH, NF - s0), tmp = chunk(c) + '.tmp.mp4';
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-', '-frames:v', String(n),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', '30', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let i = 0; i < n; i++) {
      await F.page.evaluate(t => window.renderAt(t), (s0 + i) / 30);
      const img = await F.page.screenshot({ type: 'jpeg', quality: 94 });
      if (!ff.stdin.write(img)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end(); await new Promise((res, rej) => ff.on('close', k => k === 0 ? res() : rej(new Error('ffmpeg exit ' + k))));
    fs.renameSync(tmp, chunk(c)); done += n;
    const fps = done / ((Date.now() - t0) / 1000);
    console.log(`chunk ${c + 1}/${NC}: ${fps.toFixed(1)} fps, about ${Math.max(0, Math.round((NF - (c + 1) * CH) / fps / 60))} min left`);
  }
  if (F.errors.length) console.log('page errors:', F.errors.slice(0, 5).join(' | '));
  await F.close();
  fs.writeFileSync(path.join(film, 'render', 'list.txt'), Array.from({ length: NC }, (_, c) => `file '${chunk(c).replace(/\\/g, '/')}'`).join('\n'));
  console.log(`frames ${NF} (${(NF / 30).toFixed(1)} s) in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
})().catch(e => { console.error(e); process.exit(1); });
