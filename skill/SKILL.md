---
name: silhouette-studio
description: Make a voiced, scored silhouette animation film (16:9 up to 5 min, or 9:16 short up to 2 min) with Beta Version Silhouette Studio - story, build, Kokoro voice, three.js staging and camera, procedural sound, QA gate and mp4 render. Use when the user asks for a silhouette film, silhouette short, silhouette animation or a film made with Silhouette Studio, or for a fix, re-voice, re-cut or re-render of one.
---

# Silhouette Studio

The kit lives in `kit/` of the Beta Version Silhouette Studio repo (`KIT` below). Everything runs through
`python KIT/make.py <film> <steps>`. Read `KIT/references/rules.md` (Top 12) once at the start; read each step's reference
when you reach that step, not before.

## 0. Setup (once per machine)
If `KIT/tier.json` is missing, run `python KIT/setup.py` (see SETUP.md). The tier decides render speed; tell the user which one
was detected.

## 1. Story -> read `references/story.md`
- Agree the idea, format (`short` 9:16 up to 2 min, `long` 16:9 up to 5 min) and length in one short exchange, or decide them
  yourself if the user said so.
- `python KIT/new_film.py <name> --format short|long` copies the starter (*The Spare Key*). Rewrite `story.py`: TITLE, CHARS
  (age, gender, accent, temperament), optional KOKORO voices, scenes with beats, marks, sfx cues and lines with emotion
  directions. Update `film.json` (title, tagline, endLine, endMeta, `female` list).
- Pick the look: `film.json` `"look": "black"` (default silhouettes) or `"white"` (off-white figures with dark eyes and
  brows in near-black rooms). Optional in `story.py`: `LOOKS = {"who": "black" | "white" | "shadow"}` per actor (`shadow` is
  the shadow self: black body, red rim, red subtitles) and `OPENING = {"text", "key", "color"}` with an `'opening'` first
  scene for a narration card on black with one coloured keyword.
- One feeling, one object that carries it, a last line that lands. Short lines, spoken the way people talk.

## 2. Build
`python KIT/make.py <film> build`. Fix any REFUSED (over the length cap) or date warnings before going on.

## 3. Voice
`python KIT/make.py <film> voice` (Kokoro writes `vo/line_NNN.wav`, then the build reruns on the real takes). Listen to a
few takes; respell words that come out wrong and redo them with
`python KIT/voice/kokoro_voice.py <film> --force --only N`, then build again. While voices are pending, `--placeholder`
gives hummed takes so staging can start; never render those for the user.

## 4. Sets and staging -> read `references/engine-guide.md`
- Pick a set per scene (`room`, `motel`, `laundromat`, `kitchen`), or build the place the story needs (next section).
- Write `js/set_<set>.js` per set: actors with scripts hung on marks and line times, a shot list (`dialogueCuts` plus
  hand-made wides with a `short:` version for 9:16), `render()` and `FIGS`.
- Snapshot every hand-made shot: `python KIT/snap.py <film> t1,t2`. Look at the stills at small size.
- Props come from the branded prop library (`props.js`, imported through `core.js`): `makePhone` (mark on the back and
  lock screen), `makeMug`, `makeCoffeeCup`, `makeLaptop`, `makeShoppingBag`, `makeBox`, `makeCerealBox`, `makeCan`,
  `makeBottle`, `makeTV`, `makeMagnet`, `makePoster`, `makeSign`, `printOnFigure`. Never build your own phone or mug.
- Faces act through `A.brow` (-1 angry .. 1 worried) and `A.lid` (0 open .. 1 heavy), set per frame in the set script;
  in the white look they move the brows and eyelids.
- Keep at least one readable brand piece per scene in view (QA fails the scene otherwise). The corner watermark is
  automatic and must never sit over a face; move the camera or actor, never the brand.

### Any location
The kit's sets are starting points, not a limit. When the story needs a bus stop, a hospital corridor or a rooftop, build
it as a new world module with `references/new-set.md` (plan, build checklist, exports, at least 2 library brand pieces with
one readable in a wide, test loop). `kit/sets/kitchen.js` and the `kitchen-demo` starter were built from it.

## 5. Sound -> read `references/sound.md`
Edit `audio/sound.py`: rooms, a handler for every `X('cue')`, footstep surfaces per set, ambience beds, one score motif.
`python KIT/make.py <film> sound` and read the per-scene bus table it prints.

## 6. QA -> read `references/qa.md`
`python KIT/make.py <film> qa`. Fix every fail (and warnings that show on screen), rerun until PASS. Then look at
`qa/sheets/*.jpg`: heads cut, faces too dark, brand unreadable, captions over faces. QA must be newer than every edit.

## 7. Render
- First `python KIT/make.py <film> render --seconds 10` and check a few frames; then the full render.
- One render at a time; check free RAM first, and do not start a render while a GPU voice job is running.
- Output: `<film>/out/<film>.mp4` (H.264, AAC 192 kbps, -16 LUFS, brand metadata). Report the path, length and tier to the
  user.

## Fixes later
Story edit -> build, voice (only the changed lines), sound, qa, render. Camera or staging edit -> qa, render. Sound edit ->
sound, render (QA stays fresh unless a js or story file changed).
