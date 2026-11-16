"""run_qa.py <film_dir> [--sheets] [--step 0.25] : the QA gate. Run after every change and before every render.

  1. dates   common/calcheck.py: chips, weekdays, spoken dates
  2. scenes  engine/qa/qa.js: feet on floors, walk speed 0.6-2.2 m/s, sliding feet, walking into furniture or walls,
             bodies overlapping, floating props, camera inside geometry, speaker hidden, chip vs calendar,
             someone walking into the lens (head > 45 % of the frame), the watermark over a face
  3. voices  engine/qa/voicecheck.py: missing takes, clipping, dead air, length
  4. --sheets  contact sheets per scene in qa/sheets/ for a picture review
Writes qa/report.json {pass, fails, warns, items} and qa/report.md. render.py refuses a full render unless pass is true and
the report is newer than story.py, timeline.json and every file in js/.
"""
import glob, json, os, re, subprocess, sys, time

ENGINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); KIT = os.path.dirname(ENGINE)
PY = sys.executable


def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', **kw)
    return r.returncode, (r.stdout or '') + (r.stderr or '')


def sheets(fd, tl):
    from PIL import Image, ImageDraw
    ts = []
    for s in tl['scenes']:
        if not s['set']: continue
        n = max(6, int((s['end'] - s['start']) / 3))
        ts += [round(s['start'] + (i + 0.5) * (s['end'] - s['start']) / n, 2) for i in range(n)]
    fr = os.path.join(fd, 'qa', 'frames')
    for f in glob.glob(os.path.join(fr, '*.jpg')): os.remove(f)
    code, out = run(['node', os.path.join(ENGINE, 'render_frames.js'), fd, fr, ','.join(map(str, ts))])
    if code: print(out[-2000:]); return 0
    with open(os.path.join(fd, 'film.json'), encoding='utf-8') as f: short = json.load(f).get('format') == 'short'
    os.makedirs(os.path.join(fd, 'qa', 'sheets'), exist_ok=True)
    for f in glob.glob(os.path.join(fd, 'qa', 'sheets', '*.jpg')): os.remove(f)
    fs = sorted(glob.glob(os.path.join(fr, 't*.jpg')), key=lambda f: float(os.path.basename(f)[1:-4]))
    w, h, cols = (240, 427, 4) if short else (480, 270, 3)
    for s in tl['scenes']:
        sel = [f for f in fs if s['start'] <= float(os.path.basename(f)[1:-4]) < s['end']]
        for k in range(0, len(sel), 12):
            part = sel[k:k + 12]; rows = (len(part) + cols - 1) // cols
            im = Image.new('RGB', (cols * w, rows * h)); d = ImageDraw.Draw(im)
            for i, f in enumerate(part):
                x, y = (i % cols) * w, (i // cols) * h
                im.paste(Image.open(f).resize((w, h)), (x, y)); d.text((x + 6, y + 4), os.path.basename(f)[1:-4] + 's', fill='yellow')
            im.save(os.path.join(fd, 'qa', 'sheets', f"{s['name']}_{k // 12}.jpg"), quality=85)
    return len(glob.glob(os.path.join(fd, 'qa', 'sheets', '*.jpg')))


def main():
    args = sys.argv[1:]
    fd = os.path.abspath(next((a for a in args if not a.startswith('--')), '.'))
    step = args[args.index('--step') + 1] if '--step' in args else os.environ.get('STEP', '0.25')
    os.makedirs(os.path.join(fd, 'qa'), exist_ok=True)
    rep = {'time': time.strftime('%Y-%m-%d %H:%M'), 'items': []}
    print('== dates')
    code, out = run([PY, os.path.join(KIT, 'common', 'calcheck.py'), fd])
    with open(os.path.join(fd, 'qa', 'date_report.txt'), 'w', encoding='utf-8') as f: f.write(out)
    print('\n'.join(out.strip().splitlines()[-2:]))
    for l in out.splitlines():
        m = re.match(r'\s*(FAIL|WARN)\b:?\s*(.*)', l)
        if m: rep['items'].append({'area': 'dates', 'sev': m.group(1).lower(), 'msg': m.group(2)})
    print('== scenes')
    code, out = run(['node', os.path.join(ENGINE, 'qa', 'qa.js'), fd, str(step)])
    print('\n'.join(l for l in out.strip().splitlines()[-3:] if not l.startswith('qa ')))
    sr = os.path.join(fd, 'qa', 'scene_report.json')
    if code or not os.path.exists(sr):
        rep['items'].append({'area': 'scene', 'sev': 'fail', 'msg': 'scene QA did not run: ' + out.strip()[-300:]})
    else:
        with open(sr, encoding='utf-8') as f:
            for m in json.load(f):
                if m['sev'] in ('fail', 'warn'):
                    rep['items'].append({'area': 'scene', 'sev': m['sev'], 'scene': m.get('scene'), 't0': m.get('t0', m.get('t')), 't1': m.get('t1'), 'kind': m['k'], 'msg': m['msg']})
    with open(os.path.join(fd, 'timeline.json'), encoding='utf-8') as f: tl = json.load(f)
    vr = os.path.join(fd, 'qa', 'voice_report.json')
    if tl['lines'] and any(os.path.exists(os.path.join(fd, l['file'])) for l in tl['lines']):
        print('== voices'); code, out = run([PY, os.path.join(ENGINE, 'qa', 'voicecheck.py'), fd]); print(out.strip().splitlines()[-1] if out.strip() else out)
    elif os.path.exists(vr): os.remove(vr)
    if not tl['lines']:
        with open(vr, 'w', encoding='utf-8') as f: json.dump([], f)
    if os.path.exists(vr):
        with open(vr, encoding='utf-8') as f:
            for r in json.load(f):
                if r['sev'] != 'ok': rep['items'].append({'area': 'voice', 'sev': r['sev'], 'line': r['n'], 'who': r.get('who'), 'msg': r['msg']})
    else: print('== voices: no takes yet (run the voice step, or common/placeholder_voices.py for a test)')
    if '--sheets' in args:
        print('== sheets'); print('sheets', sheets(fd, tl), '->', os.path.join(fd, 'qa', 'sheets'))
    rep['fails'] = sum(i['sev'] == 'fail' for i in rep['items']); rep['warns'] = sum(i['sev'] == 'warn' for i in rep['items'])
    rep['voices_checked'] = os.path.exists(vr); rep['pass'] = rep['fails'] == 0 and rep['voices_checked']
    with open(os.path.join(fd, 'qa', 'report.json'), 'w', encoding='utf-8') as f: json.dump(rep, f, indent=1)
    with open(os.path.join(fd, 'qa', 'report.md'), 'w', encoding='utf-8') as f:
        f.write(f"# QA report {rep['time']}\n\n{'PASS' if rep['pass'] else 'BLOCKED'}: {rep['fails']} fail, {rep['warns']} warn\n\n")
        for i in rep['items']: f.write(f"- **{i['sev']}** [{i['area']}] {i.get('scene', '') or ''} {i.get('t0', '') or ''} {i['msg']}\n")
    print(f"QA {'PASS' if rep['pass'] else 'BLOCKED'}: {rep['fails']} fail, {rep['warns']} warn" + ('' if rep['voices_checked'] else ' (voices not checked yet)'))
    for i in rep['items'][:15]:
        if i['sev'] == 'fail': print('  FAIL', i['area'], i.get('scene', '') or '', i.get('t0', '') or '', i['msg'])
    return 0 if rep['pass'] else 1


if __name__ == '__main__':
    sys.exit(main())
