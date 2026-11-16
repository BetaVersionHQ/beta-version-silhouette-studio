#!/usr/bin/env python
"""Beta Version Silhouette Studio - voice step (Kokoro-82M, Apache-2.0).

    python kit/voice/kokoro_voice.py <film_dir> [--device auto|cpu|cuda|mps] [--force] [--only 0,2]

Reads <film_dir>/vo/lines.json, writes <film_dir>/vo/line_NNN.wav (mono, 24 kHz,
16-bit, peak -3 dBFS) and <film_dir>/vo/voice_report.json.
"""
import argparse, json, os, re, sys, time
from pathlib import Path

os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
import numpy as np
import soundfile as sf

SR = 24000
PEAK = 10 ** (-3 / 20)
LEAD, TAIL = 0.05, 0.15
GAP = {"comma": 0.2, "sentence": 0.35, "ellipsis": 0.6, "dash": 0.25}
ESPEAK_HINT = ("Hint: if this is a G2P/espeak error, install espeak-ng "
               "(Windows: winget install eSpeak-NG.eSpeak-NG, macOS: brew install espeak-ng, Linux: apt install espeak-ng).")

# Auto-pick pools, best-sounding first.
POOLS = {
    ("us", "f"): ["af_heart", "af_bella", "af_nicole", "af_sarah", "af_nova", "af_aoede", "af_kore", "af_alloy", "af_jessica", "af_river", "af_sky"],
    ("us", "m"): ["am_michael", "am_adam", "am_eric", "am_liam", "am_onyx", "am_fenrir", "am_echo", "am_puck"],
    ("uk", "f"): ["bf_emma", "bf_isabella", "bf_alice", "bf_lily"],
    ("uk", "m"): ["bm_george", "bm_fable", "bm_lewis", "bm_daniel"],
}
CHILD_VOICE = {"f": "af_sky", "m": "am_puck"}

SLOW = re.compile(r"\b(tired|sad|quiet|quietly|small|soft|softly|whisper\w*|hesitant|weary|hushed|low)\b", re.I)
FAST = re.compile(r"\b(angry|furious|excited|rushed|panicked|panic|urgent|shout\w*|frantic|hurried)\b", re.I)


def emotion_speed(emotion):
    e = emotion or ""
    if SLOW.search(e):
        return 0.9
    if FAST.search(e):
        return 1.08
    return 1.0


def describe(desc):
    """-> (gender 'f'/'m', british?, child?) from a CHARS description."""
    d = desc.lower()
    m = re.search(r"\b(\d{1,3})\b", d)
    age = int(m.group(1)) if m else 30
    if re.search(r"\b(woman|girl|female|lady)\b", d): g = "f"
    elif re.search(r"\b(man|boy|male|guy)\b", d): g = "m"
    elif re.search(r"\b(she|her)\b", d): g = "f"
    else: g = "m"
    uk = bool(re.search(r"\b(british|london|uk|scottish|welsh|received pronunciation)\b", d)) and "american" not in d
    return g, uk, age < 14 or bool(re.search(r"\b(child|kid|toddler)\b", d))


def pick_voices(chars, kokoro_map, extra=()):
    """-> {char: (voice, speed_mult)}; never the same voice for two characters."""
    out, used = {}, set()
    for cid, v in (kokoro_map or {}).items():
        voice, sp = (v, 1.0) if isinstance(v, str) else (v[0], float(v[1]))
        out[cid] = (voice, sp); used.add(voice)
    chars = dict(chars)
    for cid in extra:
        chars.setdefault(cid, "")
    for cid, desc in chars.items():
        if cid in out:
            continue
        g, uk, child = describe(desc)
        if child:
            cand = [CHILD_VOICE[g]] + POOLS[("us", g)]
        else:
            cand = POOLS[("uk" if uk else "us", g)] + POOLS[("us" if uk else "uk", g)]
        voice = next((c for c in cand if c not in used), None) or \
            next(c for p in POOLS.values() for c in p if c not in used)
        used.add(voice)
        out[cid] = (voice, 1.05 if child else 1.0)
    return out


def split_pieces(text):
    """-> [(piece, gap_after_seconds)]; the gap after the last piece is ignored."""
    text = re.sub(r"\s+", " ", text.replace("…", "...")).strip()
    toks = re.split(r"(\.{3,}|(?<=[.!?])[\"')\]]*\s+|\s+[—–]\s+)", text)
    pieces, cur = [], ""
    for t in toks:
        if re.fullmatch(r"\.{3,}", t):
            pieces.append(((cur + "...").strip(), GAP["ellipsis"])); cur = ""
        elif re.fullmatch(r"[\"')\]]*\s+", t):
            pieces.append(((cur + t).strip(), GAP["sentence"])); cur = ""
        elif re.fullmatch(r"\s+[—–]\s+", t):
            pieces.append((cur.strip() + ",", GAP["dash"])); cur = ""
        else:
            cur += t
    if cur.strip():
        pieces.append((cur.strip(), 0.0))
    out = []
    for p, gap in pieces:  # split long sentences at commas
        if len(p) > 60 and "," in p:
            sub = [s.strip() for s in re.split(r"(?<=,)\s+", p) if s.strip()]
            for k, s in enumerate(sub):
                out.append((s, GAP["comma"] if k < len(sub) - 1 else gap))
        else:
            out.append((p, gap))
    return [(p, g) for p, g in out if re.search(r"\w", p)]


def trim(a, lead, tail, thr=0.01):
    """Trim silence, keeping `lead`/`tail` seconds of padding (adds zeros if the file had less)."""
    idx = np.where(np.abs(a) > thr)[0]
    if len(idx) == 0:
        return a
    s, e = idx[0], idx[-1] + 1
    pre, post = int(lead * SR), int(tail * SR)
    core = a[s:e]
    return np.concatenate([np.zeros(pre, np.float32), core, np.zeros(post, np.float32)])


def pick_device(req):
    import torch
    if req != "auto":
        return req
    if torch.cuda.is_available(): return "cuda"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available(): return "mps"
    return "cpu"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("film_dir")
    ap.add_argument("--device", default="auto", choices=["auto", "cpu", "cuda", "mps"])
    ap.add_argument("--force", action="store_true", help="regenerate existing wavs")
    ap.add_argument("--only", default="", help="comma list of line numbers (n) to redo, e.g. 0,2")
    a = ap.parse_args()

    vo = Path(a.film_dir) / "vo"
    data = json.loads((vo / "lines.json").read_text(encoding="utf-8"))
    lines = data["lines"]
    only = {int(x) for x in a.only.split(",") if x.strip()} if a.only else None
    voices = pick_voices(data.get("characters", {}), data.get("kokoro"), {ln["char"] for ln in lines})
    print("voice mapping:", ", ".join(f"{c} -> {v[0]} (x{v[1]})" for c, v in voices.items()))

    todo = [ln for ln in lines if (only is None or int(ln["n"]) in only)
            and (a.force or only is not None or not (vo / f"line_{int(ln['n']):03d}.wav").exists())]
    report_path = vo / "voice_report.json"
    old = json.loads(report_path.read_text()) if report_path.exists() else {}
    report = {"voices": {c: v[0] for c, v in voices.items()}, "device": old.get("device"),
              "seconds": old.get("seconds", {}), "synth_seconds": old.get("synth_seconds", {})}
    if not todo:
        print("nothing to do (all wavs exist; use --force or --only)")
        report_path.write_text(json.dumps(report, indent=1)); return

    t0 = time.time()
    try:
        from kokoro import KModel, KPipeline
        device = pick_device(a.device)
        kmodel = KModel(repo_id="hexgrad/Kokoro-82M").to(device).eval()
        pipes = {}
        def pipe(voice):
            lc = voice[0]  # a = American, b = British
            if lc not in pipes:
                pipes[lc] = KPipeline(lang_code=lc, repo_id="hexgrad/Kokoro-82M", model=kmodel)
            return pipes[lc]
    except Exception as e:
        sys.exit(f"Kokoro failed to load: {e}\nHint: pip install -r kit/voice/requirements.txt "
                 f"(internet needed once for the weights). {ESPEAK_HINT}")
    print(f"device: {device}; loaded in {time.time()-t0:.1f}s")
    report["device"] = device

    for ln in todo:
        n = int(ln["n"]); voice, vsp = voices[ln["char"]]
        speed = round(vsp * emotion_speed(ln.get("emotion")), 3)
        t1 = time.time(); chunks = []
        pcs = split_pieces(ln["text"])
        for k, (piece, gap) in enumerate(pcs):
            try:
                audio = [np.asarray(r.audio, dtype=np.float32) for r in
                         pipe(voice)(piece, voice=voice, speed=speed, split_pattern=None) if r.audio is not None]
            except Exception as e:
                sys.exit(f"line {n}: synthesis failed: {e}\n{ESPEAK_HINT}")
            if not audio:
                continue
            chunks.append(trim(np.concatenate(audio), 0.0, 0.0))
            if k < len(pcs) - 1:
                chunks.append(np.zeros(int(gap * SR), dtype=np.float32))
        wav = trim(np.concatenate(chunks), LEAD, TAIL)
        wav = (wav * (PEAK / (float(np.max(np.abs(wav))) or 1.0))).astype(np.float32)
        sf.write(str(vo / f"line_{n:03d}.wav"), wav, SR, subtype="PCM_16")
        dt = time.time() - t1
        report["seconds"][str(n)] = round(len(wav) / SR, 2); report["synth_seconds"][str(n)] = round(dt, 2)
        print(f"line {n:03d} [{ln['char']}/{voice} x{speed}] {len(wav)/SR:.2f}s audio in {dt:.1f}s: {ln['text']}")
    report["time_taken"] = round(time.time() - t0, 1)
    report_path.write_text(json.dumps(report, indent=1))
    print(f"done in {report['time_taken']}s -> {vo}")


if __name__ == "__main__":
    main()
