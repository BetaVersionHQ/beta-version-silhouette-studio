# QA gate

`python kit/make.py <film> qa` runs `kit/engine/qa/run_qa.py <film> --sheets` and writes `qa/report.json` + `qa/report.md`.
`render.py` refuses to render unless the report says PASS and is newer than `story.py`, `film.json`, `timeline.json` and every
file in `js/`. Run it after every change.

| Part | Checks | Severity |
|---|---|---|
| dates (`common/calcheck.py`) | chip weekday vs date in YEAR, time running backwards, "YEARS LATER" years, after-midnight days, spoken weekdays | fail / warn |
| scenes (`engine/qa/qa.js`, every 0.25 s) | feet on the floor, no floating, walk speed 0.6-2.2 m/s, sliding feet, walking into furniture or walls, bodies overlapping, floating props, camera inside geometry, speaker hidden or off screen, chip vs calendar | fail / warn |
| lens + brand | a head over 45 % of the frame height (someone walking into the lens), a figure closer than 0.9 m to the lens, the corner watermark over a face | fail |
| heads | two actors' head circles overlapping on screen (shared area over the smaller head): they merge into one shape | warn over 5 %, fail over 50 % |
| voices (`engine/qa/voicecheck.py`) | missing or unreadable take, clipping, dead air inside a line, take length far from its words | fail / warn |
| sheets | contact sheets per scene in `qa/sheets/` (9:16 films get tall tiles) | look at them |

## Reading failures
- **speaker hidden / off screen:** the shot list holds a wide or a hand-made shot over a line. Add a speaker cut, or let
  `dialogueCuts` make one (do not `drop` it).
- **walking into the lens:** a hand-made shot with someone walking toward it, or an over-the-shoulder single. Move the camera,
  stop the walk earlier, or use `whoFrame` singles.
- **slide / speed:** a walk timed from a line instead of from distance. Let the walk take distance / ~1.2 m/s.
- **heads overlap:** stand people so no head sits behind another from any camera in the scene: offset them sideways (about
  0.8 m or more), mix sitting and standing, or give the shot its own camera; the speaker search avoids it too.
- **watermark covers a face:** move the camera or the actor; never move the watermark (to drop it for a whole film, set film.json `"watermark": false`).
- **voice fails:** re-run `make.py <film> voice` (Kokoro `--force --only N` redoes single lines).

## Picture review (the gate cannot see everything)
Look at `qa/sheets/*.jpg` at small size: heads cut by the frame edge, faces too dark to read, the brand readable at least once
per set, captions clear of faces, nothing popping in. Then render a few seconds with `--seconds 10` and watch it.
