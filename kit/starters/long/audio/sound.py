# STARTER mix: dialogue + procedural effects + ambience + score -> audio/final_audio.wav (48 kHz stereo).
# Everything comes from code in kit/engine/audio/sfxlib.py (no sample packs): read it for the effects (door_open,
# footstep, rain_bed, neon_buzz, ...), rooms and instruments. Buses: dialogue (room reverb, phone filter), fx, ambience,
# music (ducked under voices). kit/make.py runs this after the footstep probe.
import os, sys, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
KIT = os.environ.get('SS_KIT') or next((os.path.join(p, 'kit') for p in [os.path.dirname(ROOT), os.path.dirname(os.path.dirname(ROOT)), os.getcwd()]
                                        if os.path.exists(os.path.join(p, 'kit', 'engine', 'audio', 'sfxlib.py'))), None)
if not KIT: raise SystemExit('cannot find kit/: run this through  python kit/make.py <film> sound')
sys.path.insert(0, os.path.join(KIT, 'engine', 'audio'))
from sfxlib import *
TL = init(ROOT); SC = G['SC']
have = lambda s: s in SC                     # a test cut may build only some scenes (make.py --scenes)
rooms({s: r for s, r in {'door': (0.45, 10, 0.06), 'lot': (0.9, 4, 0.04), 'wash': (0.6, 8, 0.07)}.items() if have(s)})
n = place_dialogue(pan={'ana': -0.1, 'ben': 0.1}); print('voice lines placed', n)

# effects: story cues (X('name') in story.py) and footsteps from the animation (events.json from probe_events.js)
for e in TL['sfx']:
    t, nm = e['t'], e['name']
    if nm == 'door_open': fxat(t, door_open(0.8), 0.6, 0.4)
floor = {'door': 'wood', 'lot': 'stone', 'wash': 'stone'}
for e in G['EV'].get('steps', []):
    fxat(e['t'], footstep(floor.get(scene_of(e['t']), 'wood'), 0.9), 0.3, float(np.clip(e['x'] / 6, -0.5, 0.5)))

# ambience per scene
def g_room(n, s): a, b = roomtone(n); r = rain_bed(n, 0.5, inside=True); return a * 0.4 + r[0], b * 0.4 + r[1]
def g_lot(n, s): c = crickets_bed(n, 0.8); h = neon_buzz(n, 0.7); w = wind_bed(n, 0.3); return c[0] + h[0] + w[0], c[1] + h[1] + w[1]
def g_wash(n, s): a, b = roomtone(n); h = hum_bed(n, 60, 0.8); return a * 0.5 + h[0], b * 0.5 + h[1]
for s, g in (('door', g_room), ('lot', g_lot), ('wash', g_wash)):
    if have(s): seg([s], g, 0.8)

# score: soft pads and a music box that follow the scenes
if have('title'): a, b = cue('title'); chords(a, b + 1, ['Am', 'F'], 3, pad, 0.04)
for s, prog in (('door', ['Am', 'F', 'C', 'G']), ('lot', ['F', 'C', 'G', 'Am']), ('wash', ['C', 'G', 'Am', 'F'])):
    if have(s): a, b = cue(s); chords(a + 0.5, b, prog, 2.5, pad, 0.035)
if have('endcard'): a, b = cue('endcard'); mput(a, music_box(mtof(76), 4, 0.3))

mixdown(ROOT + '/audio/final_audio.wav', amb_gains={'title': 0.0, 'endcard': 0.0}, mus_gains={'title': 1.0, 'endcard': 1.0}, mus_default=0.65)
