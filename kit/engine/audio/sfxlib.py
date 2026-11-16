# sfxlib.py : Beta Version Silhouette Studio procedural sound (free, no samples). A film's audio/sound.py does
#   from sfxlib import *; init('<film dir>')
# then places dialogue, effects, ambience and score on the buses and calls mixdown().
import json, os, numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, resample_poly, fftconvolve
SR = 48000; f32 = np.float32
rng = np.random.default_rng(11)
G = {}  # film state: TL, N, SC, M, ROOT, buses, voice_env

def init(root, seed=11):
    global rng
    rng = np.random.default_rng(seed)
    G['ROOT'] = os.path.abspath(root).replace(os.sep, '/').rstrip('/') + '/'
    with open(G['ROOT'] + 'timeline.json', encoding='utf-8') as f: TL = json.load(f)
    G['TL'] = TL
    G['N'] = int(TL['end'] * SR) + SR; G['SC'] = {s['name']: s for s in TL['scenes']}; G['M'] = TL['marks']
    G['TT'] = np.arange(G['N'], dtype=f32) / SR
    for b in ('dlg', 'fx', 'amb', 'mus'): G[b] = Bus()
    G['voice_env'] = np.zeros(G['N'], f32); G['IRS'] = {}
    ev = G['ROOT'] + 'events.json'
    if os.path.exists(ev):
        with open(ev, encoding='utf-8') as f: G['EV'] = json.load(f)
    else: G['EV'] = {'steps': []}
    return TL

mk = lambda s, n: G['M'][f'{s}.{n}']
lines = lambda s: [l for l in G['TL']['lines'] if l['scene'] == s]
lend = lambda l: l['start'] + l['dur']
def cue(name): s = G['SC'][name]; return s['start'], s['end']
def scene_of(t):
    for s in G['TL']['scenes']:
        if s['start'] <= t < s['end']: return s['name']
    return G['TL']['scenes'][-1]['name']

# ---------------- dsp helpers ----------------
def sos(kind, f, order=2): return butter(order, f, kind, fs=SR, output='sos')
def lp(x, f, o=2): return sosfilt(sos('lowpass', f, o), x).astype(f32)
def hp(x, f, o=2): return sosfilt(sos('highpass', f, o), x).astype(f32)
def bp(x, lo, hi, o=2): return sosfilt(sos('bandpass', [lo, hi], o), x).astype(f32)
def noise(n): return rng.standard_normal(n).astype(f32)
def tt(d): return np.arange(int(d * SR), dtype=f32) / SR
def expd(d, k): return np.exp(-tt(d) * k).astype(f32)
def att(x, a=0.003): n = max(1, min(len(x), int(a * SR))); x = x.astype(f32); x[:n] *= np.linspace(0, 1, n, dtype=f32); return x
def brown(n): b = np.cumsum(noise(n)).astype(f32); b = hp(b, 25); return b / (np.abs(b).max() + 1e-9)
def smoothstep(a, b, x): u = np.clip((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u)
def wl(x, a, b, f=0.15): return (smoothstep(a, a + f, x) * (1 - smoothstep(b - f, b, x))).astype(f32)
def win(a, b, fa=0.3, fb=0.3): TT = G['TT']; return (smoothstep(a, a + fa, TT) * (1 - smoothstep(b - fb, b, TT))).astype(f32)
def mtof(m): return 440 * 2 ** ((m - 69) / 12)

class Bus:
    def __init__(s): N = G['N']; s.L = np.zeros(N, f32); s.R = np.zeros(N, f32)
    def add(s, t, x, g=1.0, pan=0.0):
        N = G['N']; i = int(t * SR)
        if i >= N or i + len(x) <= 0: return
        if i < 0: x = x[-i:]; i = 0
        x = x[:N - i] * g; l = np.cos((pan + 1) * np.pi / 4) * 1.414; r = np.sin((pan + 1) * np.pi / 4) * 1.414
        s.L[i:i + len(x)] += x * l; s.R[i:i + len(x)] += x * r
    def addst(s, t, L, R, g=1.0):
        N = G['N']; i = int(t * SR)
        if i < 0: L, R = L[-i:], R[-i:]; i = 0
        n = min(len(L), N - i)
        if n > 0: s.L[i:i + n] += L[:n] * g; s.R[i:i + n] += R[:n] * g

# ---------------- rooms ----------------
def ir(dur, decay, bright=4000, seed=0):
    r = np.random.default_rng(seed); n = int(dur * SR)
    x = (r.standard_normal(n) * np.exp(-np.arange(n) / SR * decay)).astype(f32); x = lp(x, bright); x[:int(0.004 * SR)] = 0
    return x / np.sqrt((x ** 2).sum())
def rooms(spec):  # {scene: (ir seconds, decay, wet)}
    for i, (k, v) in enumerate(spec.items()): G['IRS'][k] = (ir(v[0], v[1], seed=i), ir(v[0], v[1], seed=i + 50), v[2])
def place_wet(bus, t, x, scene, g=1.0, pan=0.0, wetmul=1.0):
    bus.add(t, x, g, pan)
    if scene in G['IRS']:
        a, b, w = G['IRS'][scene]; w *= wetmul
        if w > 0: bus.addst(t, fftconvolve(x, a).astype(f32) * w * g, fftconvolve(x, b).astype(f32) * w * g)
def fxat(t, x, g=1.0, pan=0.0, wet=1.0): place_wet(G['fx'], t, x, scene_of(t), g, pan, wet)

# ---------------- dialogue ----------------
def radio_filter(a): a = bp(a, 400, 3000, 3) * 2.2; a = np.tanh(a * 2.0) / 1.5; return (a + bp(noise(len(a)), 1500, 5000) * 0.02 * (np.abs(a) > 0.01)).astype(f32)
def phone_filter(a): a = bp(a, 320, 3400, 3) * 1.9; return (np.tanh(a * 1.5) / 1.3).astype(f32)
def place_dialogue(pan=None, gains=None, vo_dir='vo/final'):
    pan = pan or {}; gains = gains or {}; got = 0
    for i, l in enumerate(G['TL']['lines']):
        p = G['ROOT'] + l.get('file', f'{vo_dir}/line_{i:03d}.wav')
        if not os.path.exists(p): continue
        a, sr = sf.read(p); a = a.mean(1) if a.ndim > 1 else a
        if sr != SR: from math import gcd; g_ = gcd(SR, sr); a = resample_poly(a, SR // g_, sr // g_)
        a = hp(a.astype(f32), 70); pn = pan.get(l['who'], 0.0)
        if 'radio' in l['voice']: a = radio_filter(a); pn = pan.get('radio', 0.15)
        elif 'phone' in l['voice']: a = phone_filter(a); pn = 0.0
        g = gains.get(l['voice'], gains.get(l['who'], 1.0))
        wet = 0.35 if l['voice'] == 'narr' else 1.0
        place_wet(G['dlg'], l['start'], a, l['scene'], g, pn, wet)
        k = int(l['start'] * SR); n = min(len(a), G['N'] - k); G['voice_env'][k:k + n] += np.abs(a[:n]); got += 1
    G['voice_env'] = lp(G['voice_env'], 3) * 10
    return got

# ---------------- effects ----------------
def thud(v=1.0, f=70, d=0.35):
    x = tt(d); return att((np.sin(2 * np.pi * f * x * (1 - 0.3 * x)) * np.exp(-14 * x) + lp(noise(len(x)), 500) * np.exp(-30 * x) * 0.5) * v)
def marimba(f, d=0.5, v=1.0):
    x = tt(d); return (v * (np.sin(2 * np.pi * f * x) * np.exp(-9 * x) + 0.25 * np.sin(2 * np.pi * f * 3.9 * x) * np.exp(-30 * x))).astype(f32)
def latch(v=1.0): return (hp(noise(int(0.04 * SR)), 1800) * expd(0.04, 140) * 0.6 * v + marimba(2400, 0.05, 0.2 * v)[:int(0.04 * SR)]).astype(f32)
def creak(d=0.8, v=1.0, f0=260):
    x = tt(d); f = f0 + 120 * np.sin(2 * np.pi * 0.9 * x) + 40 * rng.standard_normal(len(x)).cumsum() / np.sqrt(len(x))
    pulses = (np.sin(2 * np.pi * np.cumsum(f) / SR) > 0.97).astype(f32)
    return (bp(pulses * 3 + noise(len(x)) * 0.05, 300, 2500) * np.sin(np.pi * x / d) * 0.5 * v).astype(f32)
def whoosh(d=0.9, lo=200, hi=3000):
    n = int(d * SR); x = noise(n); e = np.sin(np.pi * np.arange(n) / n) ** 2; out = np.zeros(n, f32); seg = n // 12
    for k in range(12):
        fc = lo * (hi / lo) ** (k / 11); a, b = k * seg, min(n, (k + 2) * seg)
        out[a:b] += bp(x[a:b], fc * 0.7, min(fc * 1.4, SR / 2 - 100)) * np.hanning(b - a)
    return (out * e * 0.5).astype(f32)
def door_open(v=1.0): o = np.zeros(int(1.6 * SR), f32); x = latch(v); o[:len(x)] += x; c = creak(1.2, 0.8 * v); o[int(0.15 * SR):int(0.15 * SR) + len(c)] += c; return o
def door_close(v=1.0):
    o = np.zeros(int(1.0 * SR), f32); w = whoosh(0.35, 150, 900) * 0.4 * v; o[:len(w)] += w; s = int(0.3 * SR); x = thud(v, 62, 0.5); o[s:s + len(x)] += x
    l = latch(1.2 * v); o[s + 600:s + 600 + len(l)] += l; return o
def door_slam():
    o = np.zeros(int(2.2 * SR), f32); w = whoosh(0.25, 200, 1600) * 0.6; o[:len(w)] += w; s = int(0.2 * SR)
    x = thud(1.8, 55, 0.9) + lp(brown(int(0.9 * SR)), 300) * np.exp(-tt(0.9) * 6) * 0.8; o[s:s + len(x)] += x
    r = creak(1.4, 0.25, 180); o[s + 2000:s + 2000 + len(r)] += r          # the frame and crockery rattle after
    for k in range(5): c = clink(0.12); i = s + int((0.05 + 0.04 * k) * SR); o[i:i + len(c)] += c
    return o
def clink(v=1.0):
    x = tt(0.5); c = sum(a * np.sin(2 * np.pi * f * x) * np.exp(-k * x) for f, a, k in [(2310, 0.5, 18), (3720, 0.35, 25), (5480, 0.2, 35), (1180, 0.3, 30)])
    return att((c + bp(noise(len(x)), 200, 900) * np.exp(-60 * x) * 0.6) * v * 0.6)
def mug_down(v=1.0): o = thud(0.35 * v, 180, 0.2); c = clink(0.25 * v)[:len(o)]; return (o + c * 0.5).astype(f32)
def spoon_bowl(v=1.0): x = tt(0.25); return att((np.sin(2 * np.pi * 2900 * x) * np.exp(-30 * x) * 0.3 + np.sin(2 * np.pi * 4100 * x) * np.exp(-40 * x) * 0.15 + hp(noise(len(x)), 3000) * np.exp(-100 * x) * 0.2) * v)
def chair_scrape(d=0.6):
    x = tt(d); am = np.abs(np.sin(2 * np.pi * 31 * x)) ** 2 * (0.6 + 0.4 * rng.random(len(x)))
    return (bp(noise(len(x)), 500, 2800) * am * np.sin(np.pi * x / d) * 0.45 + thud(0.4, 90, d)[:len(x)] * 0.5).astype(f32)
def footstep(surface, v=1.0):
    d = 0.16; x = tt(d); heel = bp(noise(len(x)), 70, 450) * np.exp(-38 * x)
    if surface == 'wood': body = np.sin(2 * np.pi * rng.uniform(150, 190) * x) * np.exp(-30 * x) * 0.5; click = hp(noise(len(x)), 2500) * np.exp(-120 * x) * 0.35
    elif surface == 'stone': body = bp(noise(len(x)), 400, 1500) * np.exp(-45 * x) * 0.5; click = hp(noise(len(x)), 3000) * np.exp(-80 * x) * 0.5
    elif surface == 'metal': body = (np.sin(2 * np.pi * 420 * x) + 0.6 * np.sin(2 * np.pi * 1130 * x)) * np.exp(-22 * x) * 0.25; click = hp(noise(len(x)), 2500) * np.exp(-90 * x) * 0.4
    elif surface == 'grass': body = bp(noise(len(x)), 1500, 6000) * np.exp(-25 * x) * 0.35; click = lp(noise(len(x)), 400) * np.exp(-40 * x) * 0.2; heel *= 0.5
    elif surface == 'deck': body = np.sin(2 * np.pi * rng.uniform(95, 120) * x) * np.exp(-26 * x) * 0.5; click = hp(noise(len(x)), 2200) * np.exp(-110 * x) * 0.25
    else: body = lp(noise(len(x)), 600) * np.exp(-40 * x) * 0.4; click = hp(noise(len(x)), 3000) * np.exp(-150 * x) * 0.08
    s = (heel * 0.9 + body + click) * v * rng.uniform(0.7, 1.0); toe = np.roll(s, int(0.045 * SR)) * 0.35
    return att((s + toe).astype(f32), 0.001)
def thunder(d=6.0, v=1.0):
    x = tt(d); crack = hp(noise(len(x)), 1200) * np.exp(-9 * x) * 0.5 * (rng.random() > 0.3)
    return ((lp(brown(len(x)), 120) * (np.exp(-0.6 * x) * (1 - np.exp(-5 * x))) * 1.6 + lp(brown(len(x)), 600) * np.exp(-2.5 * x) * 0.4 + crack) * v).astype(f32)
def rain_bed(n, k=1.0, inside=False):
    h1, h2 = bp(noise(n), 800, 9000) * 0.22, bp(noise(n), 800, 9000) * 0.22
    d1 = lp(hp((rng.random(n) > 0.9985).astype(f32) * noise(n) * 3, 2000), 7000) * 0.25; d2 = lp(hp((rng.random(n) > 0.9985).astype(f32) * noise(n) * 3, 2000), 7000) * 0.25
    low1, low2 = lp(brown(n), 300) * 0.35, lp(brown(n), 300) * 0.35
    L, R = (h1 + d1 + low1) * k, (h2 + d2 + low2) * k
    if inside: L, R = lp(L, 700) * 0.6, lp(R, 700) * 0.6
    return L, R
def wind_bed(n, k=1.0, gust=0.5, howl=0.0):
    x = np.arange(n, dtype=f32) / SR
    g1 = 0.55 + gust * (0.5 * np.sin(2 * np.pi * 0.07 * x + 1) + 0.3 * np.sin(2 * np.pi * 0.19 * x) + 0.2 * np.sin(2 * np.pi * 0.43 * x + 2))
    g2 = 0.55 + gust * (0.5 * np.sin(2 * np.pi * 0.06 * x + 2.5) + 0.3 * np.sin(2 * np.pi * 0.21 * x + 1) + 0.2 * np.sin(2 * np.pi * 0.37 * x))
    L = lp(brown(n), 500) * 0.6 + bp(noise(n), 300, 1400) * 0.06; R = lp(brown(n), 500) * 0.6 + bp(noise(n), 300, 1400) * 0.06
    if howl: hw = np.sin(2 * np.pi * np.cumsum(420 + 180 * g1) / SR) * 0.03 * howl * np.clip(g1 - 0.6, 0, 1); L = L + hw; R = R + np.roll(hw, 900)
    return (L * g1 * k).astype(f32), (R * g2 * k).astype(f32)
def waves_bed(n, k=1.0, period=7.0, crash=0.6):
    # surf: slow swells of filtered noise, each with a wash; crash adds the break at the crest
    x = np.arange(n, dtype=f32) / SR; out = []
    for ph in (0.0, 0.37):
        u = ((x / period + ph + 0.15 * np.sin(2 * np.pi * x / (period * 3.1))) % 1.0)
        env = np.where(u < 0.35, smoothstep(0, 0.35, u), np.exp(-(u - 0.35) * 5)).astype(f32)
        body = lp(brown(n), 380) * 0.7 + bp(noise(n), 500, 4000) * 0.12 * env + hp(noise(n), 3000) * 0.04 * env ** 2 * crash
        out.append((body * (0.25 + 0.75 * env) * k).astype(f32))
    return out[0], out[1]
def sea_open(n, k=1.0, storm=0.0):
    L, R = waves_bed(n, k, 9.0 - 4 * storm, 0.4 + storm)
    if storm: a, b = wind_bed(n, storm * 1.2, 0.8, howl=storm); L = L + a; R = R + b
    return L, R
def gull(v=1.0):
    d = rng.uniform(0.35, 0.6); x = tt(d); f = 1500 + 700 * np.sin(np.pi * x / d) - 400 * x / d + 80 * np.sin(2 * np.pi * 28 * x)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.4 * np.sin(4 * np.pi * np.cumsum(f) / SR); s = bp(s.astype(f32), 900, 5000)
    return (s * np.sin(np.pi * x / d) ** 0.7 * 0.15 * v).astype(f32)
def gulls(n, rate=0.25, v=1.0):
    L, R = np.zeros(n, f32), np.zeros(n, f32); k = rng.uniform(0.5, 3)
    while k < n / SR - 1:
        burst = int(rng.integers(1, 4)); p = rng.uniform(-0.8, 0.8); vv = rng.uniform(0.3, 1.0) * v
        for j in range(burst):
            g = gull(vv); i = int((k + j * 0.45) * SR); m = min(len(g), n - i)
            if m > 0: L[i:i + m] += g[:m] * (1 - p) / 2; R[i:i + m] += g[:m] * (1 + p) / 2
        k += rng.exponential(1 / rate) + 1.0
    return L, R
def fire_bed(n, k=1.0):
    roar = lp(brown(n), 260) * 0.35; hiss = bp(noise(n), 2000, 7000) * 0.015
    pops = np.zeros(n, f32); i = 0
    while True:
        i += int(rng.exponential(0.22) * SR) + 200
        if i >= n - 3000: break
        d = int(rng.uniform(0.004, 0.02) * SR); c = hp(noise(d), 1500) * np.exp(-np.arange(d) / d * 5) * rng.uniform(0.2, 1.0); pops[i:i + d] += c
    m = (roar + hiss + pops * 0.6) * k; return m.astype(f32), np.roll(m, 1200).astype(f32)
def kettle_whistle(d=4.0, v=1.0):
    x = tt(d); rise = smoothstep(0, 1.6, x); f = 1650 + 450 * rise + 25 * np.sin(2 * np.pi * 5.5 * x)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * rise + bp(noise(len(x)), 1500, 3500) * 0.4 * rise
    rumble = lp(brown(len(x)), 300) * 0.3; return ((tone * 0.12 + rumble * 0.4) * wl(x, 0, d, 0.4) * v).astype(f32)
def pour(d=1.6, v=1.0):
    x = tt(d); n = len(x); out = np.zeros(n, f32); seg = n // 16; base = noise(n)
    for k in range(16):
        fc = 450 + 900 * k / 15; a, b = k * seg, min(n, (k + 2) * seg); out[a:b] += bp(base[a:b], fc * 0.8, fc * 1.3) * np.hanning(b - a)
    return (out * wl(x, 0, d, 0.12) * 0.6 * v).astype(f32)
def radio_static(d, v=1.0, squelch=True):
    x = tt(d); s = bp(noise(len(x)), 600, 4500) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 3.1 * x)) * rng.random(len(x)) ** 0.2)
    crack = (rng.random(len(x)) > 0.9993).astype(f32) * noise(len(x)) * 4; s = s + hp(crack, 2000)
    if squelch: s[:int(0.08 * SR)] *= 3
    return (s * 0.08 * v * wl(x, 0, d, 0.05)).astype(f32)
def radio_beep(v=1.0): x = tt(0.18); return (np.sign(np.sin(2 * np.pi * 1000 * x)) * 0.1 * v * wl(x, 0, 0.18, 0.01)).astype(f32)
def power_out():
    o = np.zeros(int(2.5 * SR), f32); x = tt(2.5); hum = (np.sin(2 * np.pi * 50 * x) + 0.5 * np.sin(2 * np.pi * 100 * x)) * 0.05 * (1 - smoothstep(0.1, 0.9, x)) * np.where((x * 9) % 1 < 0.5, 1, 0.3)
    o += hum.astype(f32); c = thud(0.6, 90, 0.4); o[int(0.9 * SR):int(0.9 * SR) + len(c)] += c; l = latch(0.8); o[int(0.9 * SR):int(0.9 * SR) + len(l)] += l; return o
def horn(d=3.0, v=1.0):
    x = tt(d); f = 110; s = sum(np.sin(2 * np.pi * f * h * x + h) / h ** 0.9 for h in range(1, 9)) + 0.6 * sum(np.sin(2 * np.pi * f * 1.26 * h * x) / h for h in range(1, 6))
    return (lp(s.astype(f32), 1800) * wl(x, 0, d, 0.25) * 0.12 * v).astype(f32)
def engine_bed(n, k=1.0, f=38):
    x = np.arange(n, dtype=f32) / SR; s = (np.sin(2 * np.pi * f * x) + 0.6 * np.sin(4 * np.pi * f * x) + 0.3 * np.sign(np.sin(2 * np.pi * f * 0.5 * x))) * 0.05
    s = lp(s.astype(f32) + lp(brown(n), 200) * 0.3, 400) * k; return s, np.roll(s, 700)
def crank_ratchet(d, rate=4.0, v=1.0):
    o = np.zeros(int(d * SR) + SR // 4, f32); k = 0.0
    while k < d: c = (hp(noise(int(0.02 * SR)), 2500) * expd(0.02, 200) * 0.5 + marimba(1900, 0.03, 0.15)[:int(0.02 * SR)]) * v; i = int(k * SR); o[i:i + len(c)] += c; k += 1 / rate / 3
    return o
def squeak(d=0.4, v=1.0):
    x = tt(d); f = 1800 + 500 * np.sin(np.pi * x / d); s = np.sin(2 * np.pi * np.cumsum(f) / SR) * (rng.random(len(x)) ** 0.1)
    return (bp(s.astype(f32), 1200, 4000) * np.sin(np.pi * x / d) * 0.04 * v).astype(f32)
def rub(d=1.0, v=1.0): x = tt(d); return (bp(noise(len(x)), 1200, 5000) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 1.6 * x))) * wl(x, 0, d, 0.1) * 0.05 * v).astype(f32)
def paper(d=0.6, v=1.0): x = tt(d); cr = hp(noise(len(x)), 2500) * (rng.random(len(x)) > 0.6) * wl(x, 0, d, 0.05); return (cr * 0.12 * v).astype(f32)
def pen_scratch(d, v=1.0):
    x = tt(d); strokes = (np.sin(2 * np.pi * 3.3 * x) > -0.2).astype(f32) * (0.6 + 0.4 * np.sin(2 * np.pi * 11 * x)); return (bp(noise(len(x)), 2500, 8000) * strokes * 0.05 * v * wl(x, 0, d, 0.05)).astype(f32)
def splash(v=1.0): d = 0.6; x = tt(d); return (bp(noise(len(x)), 500, 6000) * np.exp(-8 * x) * 0.5 * v).astype(f32)
def crowd_bed(n, k=1.0):
    # murmur: many band-limited voices, slow random formants
    out = np.zeros(n, f32); x = np.arange(n, dtype=f32) / SR
    for j in range(10):
        f = rng.uniform(140, 260); syll = (np.sin(2 * np.pi * rng.uniform(2.5, 4.5) * x + rng.uniform(0, 6)) > 0.2).astype(f32)
        v = bp(noise(n), f * 2.5, f * 7) * lp(syll, 12) * (0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(0.03, 0.1) * x + j))
        out += v
    out = lp(out, 2400) * 0.08 * k; return out, np.roll(out, 2000)
def applause(d=4.0, v=1.0):
    x = tt(d); o = np.zeros(len(x), f32)
    for j in range(int(400 * d)):
        i = int(rng.uniform(0, d - 0.05) * SR); c = bp(noise(int(0.012 * SR)), 900, 5000) * expd(0.012, 300) * rng.uniform(0.2, 1); o[i:i + len(c)] += c
    return (o * wl(x, 0, d, 0.6) * 0.2 * v).astype(f32)
def cheer(d=2.5, v=1.0):
    x = tt(d); o = np.zeros(len(x), f32)
    for j in range(12):
        f = rng.uniform(250, 600) * np.exp(-0.15 * x) ; s = np.sin(2 * np.pi * np.cumsum(f * (1 + 0.03 * np.sin(2 * np.pi * 6 * x))) / SR); o += bp(s.astype(f32), 300, 3000) * rng.uniform(0.3, 1)
    return (o * wl(x, 0, d, 0.3) * 0.03 * v + bp(noise(len(x)), 500, 3000) * 0.04 * wl(x, 0, d, 0.3) * v).astype(f32)

# ---------------- instruments (score and on-screen music) ----------------
def piano(f, d, v):
    x = tt(d); out = np.zeros(len(x), f32); B = 0.0004
    for n in range(1, 9):
        fn = f * n * np.sqrt(1 + B * n * n)
        if fn > SR / 2.2: break
        out += (np.sin(2 * np.pi * fn * x + rng.uniform(0, 6)) * (1 / n ** 1.3) * np.exp(-x * (1.2 + 0.9 * n) * (f / 440) ** 0.3)).astype(f32)
    out += hp(noise(len(x)), 1500) * np.exp(-x * 120) * 0.05
    rel = np.ones(len(x), f32); r = min(len(x), int(0.25 * SR)); rel[-r:] = np.linspace(1, 0, r)
    return att(out * v * rel, 0.002)
def pad(fs_, d, v, bright=1400):
    x = tt(d); out = np.zeros(len(x), f32)
    for f in fs_:
        for det in (-0.12, 0.0, 0.11):
            ff = f * 2 ** (det / 12)
            for h in range(1, 6): out += (np.sin(2 * np.pi * ff * h * x + rng.uniform(0, 6)) / h ** 1.6).astype(f32)
    out = lp(out, bright) * wl(x, 0, d, min(1.5, d / 3)); return out * v / (len(fs_) * 3)
def strings(fs_, d, v, bright=2200, swell=1.2):
    # a string section: detuned sawtooths with slow vibrato, bowed attack, low-passed
    x = tt(d); out = np.zeros(len(x), f32)
    for f in fs_:
        for j, det in enumerate((-0.09, -0.03, 0.04, 0.1)):
            vib = 1 + 0.004 * np.sin(2 * np.pi * (5.0 + j * 0.3) * x + j) * smoothstep(0.3, 1.2, x)
            ph = np.cumsum(f * 2 ** (det / 12) * vib) / SR; out += (2 * (ph % 1.0) - 1).astype(f32)
    out = lp(lp(out, bright), bright * 1.3) * wl(x, 0, d, min(swell, d / 3)); return (out * v / (len(fs_) * 4)).astype(f32)
def cello(f, d, v): return strings([f], d, v * 2.2, 1200, 0.5)
def violin(f, d, v, vib=0.006, bow=0.12):
    # solo violin: sawtooth with delayed vibrato through a body (formant) filter; bow noise on the attack
    x = tt(d); vb = 1 + vib * np.sin(2 * np.pi * 5.6 * x) * smoothstep(0.15, 0.5, x)
    ph = np.cumsum(f * vb) / SR; s = (2 * (ph % 1.0) - 1).astype(f32)
    body = bp(s, 280, 1200) * 0.9 + bp(s, 2000, 3500) * 0.7 + bp(s, 4500, 6500) * 0.2
    bn = bp(noise(len(x)), 2000, 7000) * bow * np.exp(-x * 8)
    env = smoothstep(0, min(0.12, d / 3), x) * (1 - smoothstep(d - min(0.2, d / 3), d, x))
    return ((body + bn) * env * v * 0.5).astype(f32)
def bodhran(v=1.0, f=70): x = tt(0.4); return att((np.sin(2 * np.pi * f * x * (1 - 0.4 * x)) * np.exp(-11 * x) + lp(noise(len(x)), 900) * np.exp(-40 * x) * 0.3) * v)
CH = {'Am': [57, 60, 64], 'F': [53, 57, 60], 'C': [48, 52, 55], 'G': [55, 59, 62], 'Em': [52, 55, 59], 'Dm': [50, 53, 57], 'E': [52, 56, 59], 'Bb': [46, 50, 53],
      'D': [50, 54, 57], 'Bm': [47, 50, 54], 'A': [45, 49, 52], 'Fmaj7': [53, 57, 60, 64], 'Em7': [52, 55, 59, 62], 'Dm7': [50, 53, 57, 60], 'Cmaj7': [48, 52, 55, 59],
      'Am9': [57, 60, 64, 71], 'G/B': [47, 55, 59, 62], 'C/E': [52, 55, 60], 'Gsus': [55, 60, 62], 'Asus': [57, 62, 64], 'Dsus': [50, 55, 57], 'Ebmaj7': [51, 55, 58, 62]}
def mput(t, x, g=1.0, pan=0.0): G['mus'].add(t, x, g, pan)
def arp(t0, t1, prog, bpm, inst, v, pattern=(0, 1, 2, 1), octave=12, bars=1, padv=0.0, bassv=0.0, strv=0.0, note=1.6):
    beat = 60 / bpm; k = t0; i = 0
    while k < t1 - 0.05:
        ch = CH[prog[(i // (8 * bars)) % len(prog)]]
        if i % (8 * bars) == 0:
            span = min(beat * 4 * bars + 1.5, t1 - k + 1.5)
            if padv: mput(k, pad([mtof(m) for m in ch], span, padv))
            if strv: mput(k, strings([mtof(m) for m in ch], span, strv))
            if bassv: mput(k, cello(mtof(ch[0] - 12), min(beat * 4 * bars, t1 - k + 0.5), bassv))
        m = ch[pattern[i % len(pattern)] % len(ch)] + octave
        mput(k, inst(mtof(m), note, v), 1.0, 0.25 * np.sin(i))
        k += beat / 2; i += 1
def melody(t0, notes, bpm, inst, v, pan=0.0):
    beat = 60 / bpm
    for (b, m, d) in notes: mput(t0 + b * beat, inst(mtof(m), d * beat + 0.6, v), 1.0, pan)
def chords(t0, t1, prog, sec, inst, v):  # sustained chords, one every `sec` seconds
    k = 0
    while t0 + k * sec < t1 - 0.3:
        a = t0 + k * sec; mput(a, inst([mtof(m) for m in CH[prog[k % len(prog)]]], min(sec + 1.2, t1 - a + 1.0), v)); k += 1

# ---------------- ambience per scene ----------------
def seg(scene_list, gen, g, fade=0.8):
    for sname in scene_list:
        s = G['SC'][sname]; a, b = s['start'], s['end']; n = int((b - a) * SR) + 1
        L, R = gen(n, sname); e = np.ones(n, f32); f = int(fade * SR); e[:f] = np.linspace(0, 1, f); e[-f:] = np.linspace(1, 0, f)
        G['amb'].addst(a, L * e, R * e, g)
def roomtone(n): return lp(brown(n), 300) * 0.5, lp(brown(n), 300) * 0.5

# ---------------- mixdown ----------------
def sg(gains, default=1.0):
    g = np.full(G['N'], default, f32)
    for name, v in gains.items():
        if name not in G['SC']: continue
        s = G['SC'][name]; w = win(s['start'], s['end'], 0.6, 0.6); g = g * (1 - w) + v * w
    return g
def mixdown(out, amb_gains=None, mus_gains=None, amb_default=1.0, mus_default=0.7, duck=0.55, fx_gain=0.85, mus_fx=None):
    TT, N, END = G['TT'], G['N'], G['TL']['end']
    dlg, fx, amb, mus = G['dlg'], G['fx'], G['amb'], G['mus']
    venv = np.clip(G['voice_env'], 0, 1); dk = 1 - duck * venv
    amb_g = sg(amb_gains or {}, amb_default); mus_g = sg(mus_gains or {}, mus_default)
    fxL, fxR = np.tanh(fx.L * 1.2) / 1.2, np.tanh(fx.R * 1.2) / 1.2
    if mus_fx is not None: mus.L += mus_fx[0]; mus.R += mus_fx[1]
    L = dlg.L + fxL * fx_gain + amb.L * amb_g * (1 - 0.3 * venv) + mus.L * mus_g * dk
    R = dlg.R + fxR * fx_gain + amb.R * amb_g * (1 - 0.3 * venv) + mus.R * mus_g * dk
    fade = np.clip(np.minimum(TT / 0.4, (END - TT) / 1.2), 0, 1).astype(f32); L, R = L * fade, R * fade
    voiced = G['voice_env'] > 0.05
    drms = np.sqrt((dlg.L[voiced] ** 2).mean()) if voiced.sum() > SR else 0.0
    g = 10 ** (-16.5 / 20) / drms if drms > 1e-4 else 10 ** (-20 / 20) / (np.sqrt((L ** 2).mean()) + 1e-9)
    L, R = L * g, R * g
    lim = lambda x: np.where(np.abs(x) < 0.7, x, np.sign(x) * (0.7 + 0.25 * np.tanh((np.abs(x) - 0.7) / 0.25)))
    st = np.stack([lim(L), lim(R)], 1).astype(f32); sf.write(out, st, SR)
    print('gain', round(float(g), 3), 'peak', round(float(np.abs(st).max()), 3), 'rms dB', round(float(20 * np.log10(np.sqrt((st ** 2).mean()))), 1))
    for sname, s in G['SC'].items():
        a, b = int(s['start'] * SR), int(s['end'] * SR); db = lambda x: 20 * np.log10(np.sqrt((x[a:b] ** 2).mean()) + 1e-9)
        print(f"{sname:16s} mix {db(st[:, 0]):6.1f}  dlg {db(dlg.L * g):6.1f}  amb {db(amb.L * amb_g * g):6.1f}  mus {db(mus.L * mus_g * g):6.1f}  fx {db(fxL * fx_gain * g):6.1f}")
    return st

# ---------------- more beds and instruments (kite, miles, museum, road) ----------------
def crickets_bed(n, k=1.0, rate=4.5):
    # a field of crickets: a few voices, each a ~4.5 kHz chirp train with its own rhythm, spread across the stereo field
    x = np.arange(n, dtype=f32) / SR; L, R = np.zeros(n, f32), np.zeros(n, f32)
    for j in range(7):
        f = rng.uniform(3800, 5200); r = rate * rng.uniform(0.8, 1.25); ph = rng.uniform(0, 6)
        gate = (np.sin(2 * np.pi * r * x + ph) > 0.55).astype(f32) * (0.6 + 0.4 * np.sin(2 * np.pi * rng.uniform(0.05, 0.15) * x + ph) ** 2)
        trill = np.sin(2 * np.pi * f * x) * (0.5 + 0.5 * np.sin(2 * np.pi * 38 * x)); s = lp(trill * gate, 7000) * 0.012 * rng.uniform(0.5, 1.0)
        p = rng.uniform(-0.9, 0.9); L += s * (1 - p) / 2; R += s * (1 + p) / 2
    return L * k, R * k
def bird(v=1.0, kind=None):
    kind = kind or rng.choice(['tweet', 'trill', 'warble'])
    if kind == 'tweet': d = rng.uniform(0.08, 0.16); x = tt(d); f = rng.uniform(2800, 4200) + 1500 * x / d
    elif kind == 'trill': d = rng.uniform(0.4, 0.8); x = tt(d); f = rng.uniform(3000, 4000) + 600 * np.sin(2 * np.pi * 22 * x)
    else: d = rng.uniform(0.3, 0.6); x = tt(d); f = rng.uniform(2200, 3200) + 900 * np.sin(2 * np.pi * rng.uniform(5, 9) * x)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * x / d) ** 0.8; return (s * 0.05 * v).astype(f32)
def birds_bed(n, rate=0.6, v=1.0, far=0.6):
    L, R = np.zeros(n, f32), np.zeros(n, f32); k = rng.uniform(0.2, 2)
    while k < n / SR - 1:
        p = rng.uniform(-0.9, 0.9); vv = rng.uniform(0.25, 1.0) * v; kind = rng.choice(['tweet', 'trill', 'warble'])
        for j in range(int(rng.integers(1, 5))):
            b = bird(vv, kind); b = lp(b, 9000 - 5000 * far * rng.random()); i = int((k + j * rng.uniform(0.15, 0.3)) * SR); m = min(len(b), n - i)
            if m > 0: L[i:i + m] += b[:m] * (1 - p) / 2; R[i:i + m] += b[:m] * (1 + p) / 2
        k += rng.exponential(1 / rate) + 0.3
    return L, R
def pluck(f, d, v, bright=0.5):
    # Karplus-Strong string (acoustic guitar), a short body resonance on top
    n = int(d * SR); p = max(2, int(SR / f)); buf = (rng.random(p) * 2 - 1).astype(f32); buf = lp(buf, 1500 + 6000 * bright) if p > 30 else buf
    out = np.zeros(n, f32); q = buf.copy(); i = 0; decay = 0.996 if f < 200 else 0.994
    for s in range(0, n, p):
        m = min(p, n - s); out[s:s + m] = q[:m]; q = (0.5 * (q + np.roll(q, -1)) * decay).astype(f32)
    out = out + bp(out, 90, 300) * 0.4; rel = np.ones(n, f32); r = min(n, int(0.08 * SR)); rel[-r:] = np.linspace(1, 0, r)
    return att(out * rel * v * 0.6, 0.001)
def music_box(f, d, v): x = tt(d); return att((np.sin(2 * np.pi * f * x) + 0.35 * np.sin(2 * np.pi * f * 3.98 * x) * np.exp(-x * 6) + 0.2 * np.sin(2 * np.pi * f * 6.1 * x) * np.exp(-x * 9)) * np.exp(-x * 2.2) * v * 0.35, 0.001)
def hum_bed(n, f=60, k=1.0, buzz=0.0):
    x = np.arange(n, dtype=f32) / SR; s = np.sin(2 * np.pi * f * x) * 0.6 + np.sin(2 * np.pi * 2 * f * x) * 0.3 + np.sin(2 * np.pi * 3 * f * x) * 0.1
    if buzz: s = s + np.tanh(np.sin(2 * np.pi * 2 * f * x) * 6) * 0.15 * buzz * (0.7 + 0.3 * np.sin(2 * np.pi * 0.3 * x))
    s = (s * 0.01 * k).astype(f32); return s, np.roll(s, 300)
def tape_filter(a):
    # an old cassette: narrow band, a little saturation, slow wow and hiss
    x = np.arange(len(a), dtype=f32) / SR; a = bp(a, 180, 5200, 2) * 1.5; a = np.tanh(a * 1.4) / 1.2
    wow = 1 + 0.0025 * np.sin(2 * np.pi * 0.55 * x) + 0.001 * np.sin(2 * np.pi * 6.3 * x)
    idx = np.clip(np.cumsum(wow) - 1, 0, len(a) - 1); a = np.interp(idx, np.arange(len(a)), a).astype(f32)
    return (a + bp(noise(len(a)), 3000, 11000) * 0.012).astype(f32)
def tape_click(v=1.0): o = thud(0.5 * v, 300, 0.06); c = hp(noise(int(0.03 * SR)), 2500) * expd(0.03, 200) * 0.4 * v; o[:len(c)] += c; return o.astype(f32)
def tape_hiss(d, v=1.0): x = tt(d); return (bp(noise(len(x)), 3000, 11000) * 0.012 * v * wl(x, 0, d, 0.05) + lp(brown(len(x)), 120) * 0.02 * v * wl(x, 0, d, 0.05)).astype(f32)
def steam_hiss(d, v=1.0): x = tt(d); return (bp(noise(len(x)), 2500, 10000) * 0.12 * v * wl(x, 0, d, 0.4) * (0.8 + 0.2 * np.sin(2 * np.pi * 3 * x))).astype(f32)
def buzz_phone(d=1.2, v=1.0): x = tt(d); g = (np.sin(2 * np.pi * 2.2 * x) > -0.2).astype(f32); return (lp(np.sign(np.sin(2 * np.pi * 180 * x)), 700) * g * 0.08 * v * wl(x, 0, d, 0.02)).astype(f32)
def phone_ring(d=3.0, v=1.0): x = tt(d); g = ((x % 2.0) < 1.0).astype(f32); s = (np.sin(2 * np.pi * 440 * x) + np.sin(2 * np.pi * 480 * x)) * 0.5; return (bp(s, 300, 3400) * g * 0.07 * v * wl(x, 0, d, 0.02)).astype(f32)
def gravel(d=2.0, v=1.0): x = tt(d); g = (rng.random(len(x)) > 0.995).astype(f32); return (bp(lp(g * noise(len(x)) * 4, 5000), 300, 5000) * 0.3 * v * wl(x, 0, d, 0.3) + lp(brown(len(x)), 200) * 0.2 * v * wl(x, 0, d, 0.3)).astype(f32)
def engine_start(v=1.0):
    d = 3.0; x = tt(d); crank = np.sin(2 * np.pi * np.cumsum(9 + 3 * x) / SR) > 0.6; ck = lp(crank.astype(f32) * noise(len(x)), 900) * 0.4 * (x < 1.2)
    rev = lp(np.sign(np.sin(2 * np.pi * np.cumsum(25 + 40 * smoothstep(1.1, 1.6, x) * np.exp(-(x - 1.6).clip(0) * 1.5)) / SR)).astype(f32), 400) * 0.25 * smoothstep(1.0, 1.3, x)
    return ((ck + rev) * v).astype(f32)
def engine_die(v=1.0):
    d = 3.5; x = tt(d); f = 34 * (1 - smoothstep(0, 3.0, x)) + 8; cough = 1 - 0.7 * (np.sin(2 * np.pi * 2.3 * x) > 0.7) * (x < 2.2)
    s = lp(np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)).astype(f32), 380) * 0.3 * cough * (1 - smoothstep(2.4, 3.4, x)); return (s * v).astype(f32)
def neon_buzz(n, k=1.0): return hum_bed(n, 60, 0.6 * k, buzz=1.0)
