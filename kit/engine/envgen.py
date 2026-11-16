"""envgen.py <film_dir> : talk envelopes per character (30 fps RMS of their voice lines) -> <film>/env.json.
The engine uses them for head and gesture motion while someone speaks. Re-run after the voices change."""
import json, os, sys
import numpy as np, soundfile as sf

FD = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
with open(os.path.join(FD, 'timeline.json'), encoding='utf-8') as f: TL = json.load(f)
SR = 24000; N = int(TL['end'] * SR) + SR; FPS = 30; HOP = SR // FPS
tr = {}
for l in TL['lines']:
    p = os.path.join(FD, l['file'])
    if l['voice'] != l['who'] or not os.path.exists(p): continue
    a, sr = sf.read(p)
    if a.ndim > 1: a = a.mean(1)
    if sr != SR: a = np.interp(np.arange(int(len(a) * SR / sr)) * sr / SR, np.arange(len(a)), a)
    s = int(l['start'] * SR); n = max(0, min(len(a), N - s))
    tr.setdefault(l['who'], np.zeros(N))[s:s + n] += a[:n]
env = {}
for w, a in tr.items():
    r = np.array([np.sqrt(np.mean(a[i * HOP:(i + 1) * HOP] ** 2)) for i in range(int(TL['end'] * FPS) + 1)])
    env[w] = (r / (r.max() + 1e-9)).round(3).tolist()
with open(os.path.join(FD, 'env.json'), 'w', encoding='utf-8') as f: json.dump(env, f)
print('talk envelopes:', ', '.join(env) or 'none (no voice takes yet)')
