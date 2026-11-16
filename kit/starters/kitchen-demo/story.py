# KITCHEN DEMO: a 12-second scene in the kitchen set (kit/sets/kitchen.js), the set built from references/new-set.md.
# Ben picks his phone up off the table (a long-lens insert shows its back logo as he lifts it). Start it with
#   python kit/new_film.py myfilm --starter kitchen-demo --format short
TITLE = "Sunday"
YEAR = 2026
CHARS = {
    "ana": "Ana, 34, woman, a nurse who works nights, tired, warm, dry sense of humour, General American accent",
    "ben": "Ben, 36, man, her husband, quiet, a little guilty, kind, General American accent",
}
KOKORO = {"ana": "af_heart", "ben": ["am_michael", 0.95]}

B = lambda s: ('beat', s); M = lambda n: ('mark', n); X = lambda n: ('sfx', n)
def L(who, text, emo, voice=None): return ('line', who, text, emo, voice or who)

S = [
 # the kitchen at night: the phone buzzes face down on the table, he picks it up
 ('kitchen', 'kitchen', 'TUESDAY · NOV 17 · 11:20 PM', 1.0, [B(0.5), M('buzz'), X('buzz'), B(0.9),
   L('ana', "Your phone's been buzzing all night.", 'tired, teasing, turning from the counter'), B(0.3),
   M('reach'), X('pickup'), B(1.6),
   L('ben', "It's my mum. She wants us home on Sunday.", 'quiet, reading the screen, a little guilty'), B(0.4),
   L('ana', "Then we're going.", 'warm, simple, decided'), B(1.0), M('fade'), B(0.4)]),
 ('endcard', None, None, 1.0, [B(4.5)]),
]
