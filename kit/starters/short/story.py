# STARTER FILM: story, calendar and every voice line in one place.
# kit/common/build.py turns this into vo/lines.json, timeline.json and calendar.json. Replace everything below with your film.
# Three staged demo scenes, one per set (room, motel lot, laundromat). Add your own scenes the same way.
TITLE = "The Spare Key"
YEAR = 2026
# Character sheet: name, age, sex, role, voice, accent, personality. Kokoro picks a voice from it unless KOKORO says otherwise.
CHARS = {
    "ana": "Ana, 34, woman, a nurse who works nights, tired, warm, dry sense of humour, General American accent",
    "ben": "Ben, 36, man, her brother, awkward, kind, trying to apologise, General American accent",
}
# Optional: pick the Kokoro voice (and a speed multiplier) per character. Voice list: hexgrad/Kokoro-82M VOICES.md
KOKORO = {"ana": "af_heart", "ben": ["am_michael", 0.95]}

B = lambda s: ('beat', s); M = lambda n: ('mark', n); X = lambda n: ('sfx', n)
def L(who, text, emo, voice=None): return ('line', who, text, emo, voice or who)

# (scene, set or None for the title/end cards, on-screen chip or None, stretch, items)
S = [
 ('title', None, None, 1.0, [B(3.5)]),
 # the room: he still has her spare key
 ('door', 'room', 'FRIDAY · NOV 13 · 9:40 PM', 1.0, [B(0.3), X('rain_window'),
   M('door'), X('door_open'), B(1.7), M('ben_in'),        # he is inside the room before his first line
   L('ben', "Hey. I knocked.", 'awkward, quiet, standing in the doorway'),
   L('ana', "You still have the key.", 'surprised, flat, not getting up'), B(0.2),
   L('ben', "You never asked for it back.", 'small, hopeful'), B(0.6), M('fade'), B(0.6)]),
 # the motel lot: she walks out to him under the sign
 ('lot', 'motel', 'FRIDAY · NOV 13 · 11:55 PM', 1.0, [B(0.6), M('walk'), X('neon'), B(3.4),
   L('ana', "You drove all night?", 'tired, half a smile'),
   L('ben', "Six hours. The sign said vacancy.", 'shy, a little proud'), B(0.2),
   L('ana', "It always says vacancy.", 'dry, warm'), B(1.0), M('fade'), B(0.6)]),
 # the laundromat: folding at one in the morning
 ('wash', 'laundromat', 'SATURDAY · NOV 14 · 1:20 AM', 1.0, [B(1.0), M('walk'), B(2.6),
   L('ben', "Is this one free?", 'hesitant, hopeful'),
   L('ana', "They're all free after midnight.", 'dry, not looking up'), B(0.2),
   L('ben', "Then I'll take the one next to yours.", 'soft, warm'), B(1.2), M('fade'), B(0.6)]),
 # outline for the rest of a 45 to 60 s short: one more scene, then the end card. Stage it like the three above.
 ('endcard', None, None, 1.0, [B(4.5)]),
]
