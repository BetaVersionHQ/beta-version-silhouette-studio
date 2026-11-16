# Story and script

## What works
Small, universal stories: family, love, regret, second chances. One feeling per film, one object that carries it (a spare
key, a voicemail, a laundry ticket), and a last line that lands. Lines are short and spoken, the way people talk.

**Short (9:16, up to 2 min):** hook in the first 2 seconds (an image plus one line that opens a question), 2-4 scenes, one
turn, a last line, a 4-5 s end card. The title card can be skipped or kept at 2-3 s.
**Long (16:9, up to 5 min):** cold open (one image, one line), title card (3-6 s), the situation and the flaw, it gets worse,
the choice and the payoff of the object, a quiet beat, the end card.

## story.py, the single source of truth
```python
TITLE = "The Spare Key"
YEAR = 2026                                    # chips without a year use it
CHARS = {"ana": "Ana, 34, woman, a nurse who works nights, tired, warm, dry sense of humour, General American accent", ...}
KOKORO = {"ana": "af_heart", "ben": ["am_michael", 0.95]}   # optional: Kokoro voice (and speed) per character
B = lambda s: ('beat', s); M = lambda n: ('mark', n); X = lambda n: ('sfx', n)
def L(who, text, emo, voice=None): return ('line', who, text, emo, voice or who)
S = [
 ('title', None, None, 1.0, [B(3.5)]),
 ('door', 'room', 'FRIDAY · NOV 13 · 9:40 PM', 1.0, [B(0.3), M('door'), X('door_open'), B(1.7),
   L('ben', "Hey. I knocked.", 'awkward, quiet, standing in the doorway'), ...]),
 ('endcard', None, None, 1.0, [B(4.5)]),
]
```
- A scene is `(name, set, chip, stretch, items)`. `set` picks `js/set_<set>.js`; `None` with the names `title` / `endcard`
  makes the cards (text from `film.json`: `title`, `tagline`, `endLine`, `endMeta`).
- `stretch` scales the beats of a scene (1.0 for shorts, up to ~1.5 for slow drama). Lines always run at their real length.
- Lines: `who`, the text, an emotion direction (how it is said, what the body does), an optional voice key. A voice ending in
  `_phone` is the same character through a phone filter in the mix; `narr` is narration (add it to CHARS).
- Marks (`M('door')`) are the times the staging hangs on; sfx cues (`X('door_open')`) are handled in `audio/sound.py`.
- Chips: `"FRIDAY · NOV 13 · 9:40 PM"`, `"THREE WEEKS LATER"`, `"NOVEMBER 2009"`. The weekday must match the date in YEAR
  (QA checks), and time never runs backwards without a "LATER" chip.

## Build
`python kit/make.py <film> build` writes `timeline.json`, `calendar.json`, `vo/lines.json` and `env.json`. Run it again after
the voice takes exist (`make.py voice` does) so every line uses its real length. `--scenes a,b` builds only those scenes
(quick tests; line numbers and takes stay matched).

## Voice (Kokoro)
`python kit/make.py <film> voice` writes `vo/line_NNN.wav` with Kokoro-82M and rebuilds. Without `KOKORO`, voices are picked
from CHARS (woman/man, British, child). Emotion words set the pace (tired/sad/quiet slower, angry/excited faster).
Spell numbers and odd words the way they are said. `--placeholder` writes hummed test takes so staging can start before the
voices exist; never ship them.
