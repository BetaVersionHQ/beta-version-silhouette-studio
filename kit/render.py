#!/usr/bin/env python
"""render.py <film_dir> [--seconds N] [--tier GPU|ANYGPU|CPU] : the final render. 30 fps, 1280x720 (long) or 720x1280 (short).

  1. refuses unless qa/report.json says PASS and is newer than story.py, film.json, timeline.json and every js/ file
  2. draws every frame (engine/render_film.js) on the machine tier from kit/tier.json (or --tier / env TIER)
  3. audio/final_audio.wav (the sound step) -> loudness -16 LUFS, AAC 192 kbps
  4. joins it all into out/<film>.mp4 (x264 crf 19, faststart, credit in the metadata) and decodes it once to check it
--seconds N renders only the first N seconds (out/<film>_<N>s.mp4), for a quick look or a speed test.
"""
import glob, json, os, subprocess, sys

KIT = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.join(KIT, 'engine')
CREDIT = 'Made with Beta Version Silhouette Studio'


def ff(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
    if r.returncode: raise SystemExit(f'ffmpeg failed: {r.stderr.strip()[-800:]}')
    return r.stdout + r.stderr


def gate(fd):
    rp = os.path.join(fd, 'qa', 'report.json')
    if not os.path.exists(rp): raise SystemExit('REFUSED: no QA report yet. Run: python kit/make.py <film> qa')
    with open(rp, encoding='utf-8') as f: rep = json.load(f)
    if not rep.get('pass'):
        raise SystemExit(f'REFUSED: QA is BLOCKED ({rep.get("fails")} fail). Fix qa/report.md, then run the qa step again.')
    src = [os.path.join(fd, p) for p in ('story.py', 'film.json', 'timeline.json')] + glob.glob(os.path.join(fd, 'js', '*.js'))
    newer = [os.path.relpath(p, fd) for p in src if os.path.exists(p) and os.path.getmtime(p) > os.path.getmtime(rp)]
    if newer: raise SystemExit(f'REFUSED: changed after the last QA run: {", ".join(newer)}. Run the qa step again.')


def main():
    a = sys.argv[1:]
    fd = os.path.abspath(next((x for i, x in enumerate(a) if not x.startswith('--') and (i == 0 or a[i - 1] not in ('--seconds', '--tier'))), '.'))
    secs = float(a[a.index('--seconds') + 1]) if '--seconds' in a else None
    env = dict(os.environ)
    if '--tier' in a: env['TIER'] = a[a.index('--tier') + 1].upper()
    gate(fd)
    with open(os.path.join(fd, 'timeline.json'), encoding='utf-8') as f: tl = json.load(f)
    with open(os.path.join(fd, 'film.json'), encoding='utf-8') as f: film = json.load(f)
    aud = os.path.join(fd, 'audio', 'final_audio.wav')
    if not os.path.exists(aud): raise SystemExit('REFUSED: no audio/final_audio.wav. Run: python kit/make.py <film> sound')
    dur = min(secs, tl['end']) if secs else tl['end']
    r = subprocess.run(['node', os.path.join(ENGINE, 'render_film.js'), fd] + ([str(secs)] if secs else []), env=env)
    if r.returncode: raise SystemExit('frame render failed')
    name = os.path.basename(fd) + (f'_{secs:g}s' if secs else '')
    os.makedirs(os.path.join(fd, 'out'), exist_ok=True)
    out = os.path.join(fd, 'out', name + '.mp4'); tmp_a = os.path.join(fd, 'render', 'audio.m4a')
    ff(['ffmpeg', '-y', '-loglevel', 'error', '-i', aud, '-t', f'{dur:.3f}', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000',
        '-ac', '2', '-c:a', 'aac', '-b:a', '192k', tmp_a])
    meta = ['-metadata', f'title={film.get("title", name)}', '-metadata', f'comment={CREDIT}', '-metadata', f'description={CREDIT}',
            '-metadata', 'encoder=Beta Version Silhouette Studio', '-fflags', '+bitexact']
    ff(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', os.path.join(fd, 'render', 'list.txt'), '-i', tmp_a,
        '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy', '-t', f'{dur:.3f}', '-movflags', '+faststart'] + meta + [out])
    err = subprocess.run(['ffmpeg', '-v', 'error', '-i', out, '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='replace').stderr.strip()
    got = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out],
                               capture_output=True, text=True).stdout.strip() or 0)
    if err or abs(got - dur) > 0.25: raise SystemExit(f'decode check FAILED: {err[:300]} (length {got:.2f} s, expected {dur:.2f} s)')
    print(f'done: {out}  ({got:.1f} s, {os.path.getsize(out) / 1e6:.1f} MB, decode check ok)')


if __name__ == '__main__':
    main()
