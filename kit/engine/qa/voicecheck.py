"""voicecheck.py <film_dir> : the voice part of the QA gate. Checks every line in timeline.json against vo/line_NNN.wav.

Writes <film_dir>/qa/voice_report.json = [{n, who, sev: ok|warn|fail, msg}] and prints a one-line summary last.
  fail  missing take / unreadable file
  fail  clipping (more than 0.05 % of samples at full scale)
  fail  dead air inside a line longer than 2.5 s (warn above 1.6 s)
  warn  the take is much shorter or longer than the estimate for its words (0.45x / 2.2x)
"""
import json, os, re, sys
import numpy as np, soundfile as sf

FD = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
with open(os.path.join(FD, 'timeline.json'), encoding='utf-8') as f: TL = json.load(f)


def estimate(text):
    t = text.lstrip('. ')
    return (len(t.split()) / 2.6 + 0.75 * t.count('...') + 0.5 * len(re.findall(r'[.?!](?=\s+\w)', t))
            + 0.28 * len(re.findall(r'[,;:]', t)) + 0.3)


rows = []
for l in TL['lines']:
    n, who, p = l['i'], l['who'], os.path.join(FD, l['file'])
    if not os.path.exists(p):
        rows.append({'n': n, 'who': who, 'sev': 'fail', 'msg': f'missing take {l["file"]}'}); continue
    try: a, sr = sf.read(p, always_2d=False)
    except Exception as e:
        rows.append({'n': n, 'who': who, 'sev': 'fail', 'msg': f'unreadable: {e}'}); continue
    if a.ndim > 1: a = a.mean(1)
    issues, sev = [], 'ok'
    def bump(s, m):
        global sev
        issues.append(m); sev = 'fail' if 'fail' in (s, sev) else 'warn'
    dur = len(a) / sr
    if np.mean(np.abs(a) > 0.999) > 0.0005: bump('fail', 'clipping')
    fr = int(sr * 0.05); env = np.array([np.sqrt(np.mean(a[i:i + fr] ** 2)) for i in range(0, max(1, len(a) - fr), fr)])
    if len(env) > 4:
        quiet = env < max(env.max() * 0.03, 1e-4); run = best = 0
        for q in quiet[2:-2]:
            run = run + 1 if q else 0; best = max(best, run)
        gap = best * 0.05
        if gap > 2.5: bump('fail', f'dead air {gap:.1f} s')
        elif gap > 1.6: bump('warn', f'long pause {gap:.1f} s')
    ex = estimate(l['text'])
    if dur < 0.45 * ex or dur > 2.2 * ex: bump('warn', f'length {dur:.1f} s vs about {ex:.1f} s expected')
    rows.append({'n': n, 'who': who, 'sev': sev, 'msg': '; '.join(issues) or 'ok'})

os.makedirs(os.path.join(FD, 'qa'), exist_ok=True)
with open(os.path.join(FD, 'qa', 'voice_report.json'), 'w', encoding='utf-8') as f: json.dump(rows, f, indent=1)
nf = sum(r['sev'] == 'fail' for r in rows); nw = sum(r['sev'] == 'warn' for r in rows)
for r in rows:
    if r['sev'] != 'ok': print(f"{r['sev'].upper()}: line {r['n']} ({r['who']}): {r['msg']}")
print(f'voicecheck: {len(rows)} lines, {nf} fail, {nw} warn')
