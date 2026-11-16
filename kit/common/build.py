"""build.py <film_dir> [--scenes a,b] : turns a film's story.py into vo/lines.json, timeline.json and calendar.json.

Run it twice in a film's life:
  1. right after writing story.py, to get vo/lines.json for the voice step (line timing is estimated);
  2. again after the voice takes are in vo/line_NNN.wav, so every line start and duration comes from the real take.
--scenes keeps only the named scenes (a quick test of one scene; run without it for the full film).

story.py contract:
  TITLE, YEAR, CHARS = {id: "Name, age, sex, role, voice, accent, personality"}
  optional KOKORO = {id: "af_heart"} or {id: ["am_michael", 0.95]}  (voice id, speed) -> copied into vo/lines.json as "kokoro"
  S = [(scene_name, set_name or None, chip or None, stretch, [items...]), ...]   (scene 'title' / 'endcard' / 'opening' = the cards)
  items: ('beat', seconds) ('mark', name) ('sfx', name) ('line', who, text, emotion, voice)
  A voice ending in "_phone" (e.g. 'ana_phone') is the same character through a phone filter in the mix; 'narr' is narration.
  optional LOOKS = {id: 'black' | 'white' | 'shadow'}: overrides film.json "look" for one figure; 'shadow' is the shadow self
    (black with a red rim glow, red captions)
  optional OPENING = {'text': "Every night ended the same way.", 'key': 'same way', 'color': '#ff9a3c'} with a first scene
    ('opening', None, None, 1.0, [B(3.2)]): the line on black, the keyword in colour, then the next scene fades in

Formats (film.json "format"): "long" = 16:9 1280x720, at most 5 minutes; "short" = 9:16 720x1280, at most 2 minutes.
Timing: a beat lasts seconds * stretch; a line lasts its real wav duration (or an estimate) plus a 0.25 s gap.
"""
import importlib.util, json, os, re, sys, wave

GAP = 0.25
CAP = {'long': 300.0, 'short': 120.0}
args = sys.argv[1:]
FD = os.path.abspath(next((a for a in args if not a.startswith('--') and (args.index(a) == 0 or args[args.index(a) - 1] != '--scenes')), '.'))
ONLY = set(args[args.index('--scenes') + 1].split(',')) if '--scenes' in args else None
spec = importlib.util.spec_from_file_location('story', os.path.join(FD, 'story.py'))
st = importlib.util.module_from_spec(spec); spec.loader.exec_module(st)
with open(os.path.join(FD, 'film.json'), encoding='utf-8') as f: FILM = json.load(f)
FMT = 'short' if FILM.get('format') == 'short' else 'long'


def estimate(text):
    """Spoken duration estimate for a line before its take exists."""
    t = text.lstrip('. ')
    return (len(t.split()) / 2.6 + 0.75 * t.count('...') + 0.5 * len(re.findall(r'[.?!](?=\s+\w)', t))
            + 0.28 * len(re.findall(r'[,;:]', t)) + 0.3)


def wav_dur(p):
    try:
        with wave.open(p) as w: return w.getnframes() / w.getframerate()
    except Exception:
        return None


lines, scenes, marks, sfx = [], [], {}, []
t = 0.0; n = 0; real = 0
for sc in st.S:
    name, setn, chip, stretch, items = sc
    if ONLY and name not in ONLY:   # skipped scenes still use up their line numbers, so takes keep their files
        n += sum(1 for it in items if it[0] == 'line'); continue
    s0 = t
    for it in items:
        k = it[0]
        if k == 'beat': t += it[1] * stretch
        elif k == 'mark': marks[f'{name}.{it[1]}'] = round(t, 3)
        elif k == 'sfx': sfx.append({'name': it[1], 't': round(t, 3), 'scene': name})
        elif k == 'line':
            _, who, text, emo, voice = it
            f = f'vo/line_{n:03d}.wav'; d = wav_dur(os.path.join(FD, f))
            if d is None: d = estimate(text)
            else: real += 1
            lines.append({'i': n, 'who': who, 'voice': voice, 'text': text, 'start': round(t, 3), 'dur': round(d, 3),
                          'scene': name, 'file': f, '_emo': emo})
            t += d + GAP; n += 1
        else: raise SystemExit(f'unknown item {it!r} in scene {name}')
    scenes.append({'name': name, 'set': setn, 'chip': chip, 'start': round(s0, 3), 'end': round(t, 3)})

if t > CAP[FMT]:
    raise SystemExit(f'REFUSED: this story runs {t:.1f} s; a "{FMT}" film is at most {CAP[FMT]:.0f} s '
                     f'({"16:9, 5 min" if FMT == "long" else "9:16, 2 min"}). Cut beats or lines, or split it into parts.')

LOOKS = getattr(st, 'LOOKS', {}) or {}
bad = {k: v for k, v in LOOKS.items() if v not in ('black', 'white', 'shadow')}
if bad: raise SystemExit(f'LOOKS: unknown look {bad} (use black, white or shadow)')
if FILM.get('look', 'black') not in ('black', 'white'): raise SystemExit('film.json "look" must be "black" or "white"')
OPENING = getattr(st, 'OPENING', None)
if any(s['name'] == 'opening' for s in scenes) and not (OPENING and OPENING.get('text')):
    raise SystemExit("an 'opening' scene needs OPENING = {'text': ..., 'key': ..., 'color': ...} in story.py")
tl = {'format': FMT, 'scenes': scenes, 'lines': [{k: v for k, v in l.items() if k != '_emo'} for l in lines], 'marks': marks,
      'sfx': sfx, 'end': round(t, 3), 'looks': LOOKS}
if OPENING: tl['opening'] = {'text': OPENING['text'], 'key': OPENING.get('key', ''), 'color': OPENING.get('color', '#ff9a3c')}
with open(os.path.join(FD, 'timeline.json'), 'w', encoding='utf-8') as f: json.dump(tl, f, indent=1)
with open(os.path.join(FD, 'calendar.json'), 'w', encoding='utf-8') as f:
    json.dump({'year': st.YEAR, 'scenes': [{'name': s['name'], 'chip': s['chip'], 'start': s['start']} for s in scenes], 'refs': []}, f, indent=1)

film_id = os.path.basename(FD)
vo = {'title': st.TITLE, 'year': st.YEAR, 'characters': st.CHARS, 'lines': [], 'film': film_id}
if ONLY: print('NOTE: --scenes build: vo/lines.json lists only the lines of those scenes')
if getattr(st, 'KOKORO', None): vo['kokoro'] = st.KOKORO
for l in lines:
    e = {'n': l['i'], 'char': l['who'], 'text': l['text'], 'emotion': l['_emo'], 'voice': l['voice'], 'scene': l['scene']}
    if l['voice'].endswith('_phone') or (l['voice'] != l['who'] and l['voice'] != 'narr'): e['phone'] = True
    vo['lines'].append(e)
os.makedirs(os.path.join(FD, 'vo'), exist_ok=True)
with open(os.path.join(FD, 'vo', 'lines.json'), 'w', encoding='utf-8') as f: json.dump(vo, f, indent=1, ensure_ascii=False)
missing = [c for c in {l['who'] for l in lines} if c not in st.CHARS]
if missing: print('WARNING: speakers missing from CHARS:', missing)
print(f'{film_id}: {FMT}, {len(scenes)} scenes, {len(lines)} lines ({real} with real takes), {len(marks)} marks, '
      f'{len(sfx)} sfx, length {int(t // 60)}:{int(t % 60):02d}')
