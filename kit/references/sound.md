# Sound (all procedural, free)

Every sound is generated in Python by `kit/engine/audio/sfxlib.py` (numpy/scipy): no sample packs, no licences. Each film's
`audio/sound.py` imports it and writes `audio/final_audio.wav` (48 kHz stereo). `python kit/make.py <film> sound` first runs the
footstep probe (`events.json`: heel strikes from the animation), then the film's `sound.py`.

## Structure of sound.py
```python
TL = init(ROOT)                                   # timeline, marks, footstep events, four buses
rooms({'door': (0.45, 10, 0.06)})                 # per-scene reverb: (seconds, decay, wet)
place_dialogue(pan={'ana': -0.1, 'ben': 0.1})     # voices, room reverb, phone/radio filters
for e in TL['sfx']: ...                           # story cues X('name') -> fxat(t, door_open(0.8), gain, pan)
for e in G['EV']['steps']: fxat(e['t'], footstep('wood'), 0.3, pan)
seg(['door'], g_room, 0.8)                        # ambience beds per scene, cross-faded
chords / arp / melody / mput(...)                 # score
mixdown(out, amb_gains={'title': 0, 'endcard': 0}, mus_gains={'title': 1, 'endcard': 1}, mus_default=0.65)
```
- **Effects:** `door_open/close/slam`, `latch`, `creak`, `footstep('wood'|'grass'|'stone'|'metal'|'deck')`, `chair_scrape`,
  `mug_down`, `clink`, `pour`, `kettle_whistle`, `buzz_phone`, `phone_ring`, `thunder`, `engine_start/die`, `horn`, `splash`,
  `paper`, `pen_scratch`, `whoosh`, `applause`, `tape_click`, `power_out` and more (read the file).
- **Beds:** `rain_bed(inside=)`, `wind_bed`, `waves_bed`, `crickets_bed`, `birds_bed`, `fire_bed`, `crowd_bed`, `engine_bed`,
  `hum_bed`, `neon_buzz`, `roomtone`.
- **Score:** `piano`, `pad`, `strings`, `cello`, `violin`, `pluck`, `music_box`; `chords` (one chord every N seconds), `arp`,
  `melody`, `mput(t, audio, gain, pan)`, chord table `CH`. One motif per film, carried by the emotion.
- **Mix:** music ducks under voices, ambience dips a little; dialogue sits around -16.5 dB RMS; a soft limiter. The render
  loudness-normalises the whole film to -16 LUFS and encodes AAC 192 kbps.

## Rules
- Every `X('cue')` in the story needs a handler; read the printed per-scene table for a bus that is silent by mistake.
- Map each set to a footstep surface. Export `FIGS` from every set module or the probe finds no walkers.
- Title and end cards: ambience 0, music 1.0.
- A test cut built with `--scenes` has only those scenes: guard per-scene code with `if 'name' in SC` (the starter does).
