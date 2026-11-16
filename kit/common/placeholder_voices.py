#!/usr/bin/env python
"""placeholder_voices.py [film_dir] : writes hummed placeholder takes vo/line_NNN.wav (right length, pitch per character)
so timing, staging, QA and a test render can run before the real voices exist. Re-run build.py afterwards.
Never ship these: replace them with the acted takes from kit/voice/kokoro_voice.py."""
import json, os, sys, zlib
import numpy as np, soundfile as sf
FD = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
v = json.load(open(os.path.join(FD, 'vo', 'lines.json'), encoding='utf-8'))
fem = set(json.load(open(os.path.join(FD, 'film.json'), encoding='utf-8')).get('female', []))
sr = 24000
for l in v['lines']:
    p = os.path.join(FD, 'vo', f"line_{l['n']:03d}.wav")
    if os.path.exists(p): continue
    d = len(l['text'].split()) / 2.6 + 0.3; t = np.arange(int(d * sr)) / sr
    base = (200 if l['char'] in fem else 120) * (1 + (zlib.crc32(l['char'].encode()) % 20) / 100)
    f = base * (1 + 0.12 * np.sin(2 * np.pi * 0.7 * t))
    a = 0.3 * np.sin(2 * np.pi * np.cumsum(f) / sr) * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 2.5 * t)))
    sf.write(p, a.astype(np.float32), sr)
print('placeholder takes written; now run: python kit/make.py <film> build  (or python kit/common/build.py <film>)')
