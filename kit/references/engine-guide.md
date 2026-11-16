# Engine guide: sets, staging, camera

A film is a web page drawn by the engine (`kit/engine/index.html` + `js/main.js`). `window.renderAt(t)` draws any time `t`;
the renderers step `t` at 30 fps and screenshot each frame. `main.js` loads `js/set_<set>.js` for each scene in
`timeline.json`, calls its `render(t, sceneName, R)`, runs bloom + FXAA, then draws the film look (vignette, grain, fades), the
corner watermark, the date chip, captions over the speaker's head and the title and end cards.

A film folder holds only its own files: `story.py`, `film.json`, `js/set_*.js`, `audio/sound.py` (plus generated files).
`kit/engine/serve.js` serves the film first, then the engine (`index.html`, `js/core|stage|act|main|brand.js`), then the sets in
`kit/sets/` (a film's `js/room.js` overrides the kit's if you copy one in to customise it).

## Formats
`film.json` `"format"`: `"long"` = 16:9 1280x720, at most 5 minutes; `"short"` = 9:16 720x1280, at most 2 minutes. 30 fps.
`build.py` refuses a story over the cap. In 9:16 the speaker cameras frame head to knees (head ~20 % of the height), two-shots
are replaced by singles, and hand-made shots open their lens (`portraitFov`). A hand-made shot can carry its own 9:16 version:
`{ name, pos, look, fov, pos2, short: { pos, look, fov, pos2 } }`. Always snapshot both if you support both.

## Module pattern
- **World module** (`kit/sets/room.js`, `motel.js`, `laundromat.js`, `kitchen.js`): `export const ST = new Stage(name, {bounds:[x0,x1,z0,z1]})`,
  geometry, lights, `ST.block()` / `ST.blockC()` footprints for everything people walk around, `ST.seat()` seats, figures
  `F = {name: ST.fig(name, rimColor, {bun|ponytail, s}, strength)}`, tracked props `ST.track(mesh, name)`, `only(...names)`.
- **Set module** (the film's `js/set_<set>.js`): `Actor`s with scripts, a `pose(t)`, a shot list, and
  `export function render(t, sname, R)` returning `{heads: {who: headPivot}}` and filling `R.exposure`,
  `R.bloom = [strength, threshold, radius]`, `R.scene`, `R.camera`, `R.fade`. Also `export const FIGS` (footsteps and QA use it).
- A new location: follow `new-set.md` (Build any location) to write `kit/sets/<name>.js` (or one in the film's `js/`),
  then write `js/set_<name>.js`.

## Sets in the kit
| Set | What it is | Brand in the world | Useful exports |
|---|---|---|---|
| `room` | living room at night: sofa, armchair, coffee table, lamp, window, door to a lit hallway | framed poster above the sofa, mug and phone on the table, box by the wall | `DOOR_AT`, `DOOR_IN`, `setDoor(k)`, seats `sofaL` `sofaR` `chair`, `PHONE`, `LAMP` |
| `motel` | roadside motel lot at night: room row, walkway, office, ice machine, sodium lamp, desert, stars | lit sign box under the MOTEL neon on the roadside sign | `ROOM_DOORS`, `ICE`, `SIGN`, `night(t)` |
| `laundromat` | coin laundromat: washers, dryers, folding table, chairs, glass door to the street | lit price board on the right wall, soap box on the table, coffee cup | `TABLE`, seats `ch_-2.6` `ch_-1.8` `ch_-1` `washer_top`, `DOOR_OUT`, `DOOR_IN`, `setDoor(k)`, `lights(mode)`, `machines(t)` |
| `kitchen` | kitchen at night: counter with sink and hob, upper cabinets, fridge, table and three chairs, window on the city, pendant lamp, doorway to a lit hall | poster, mugs and cereal box on the counter, fridge magnet, shopping bag, phone face down on the table | `COUNTER`, `COUNTER_AT`, `TABLE`, seats `chair_back` `chair_left` `chair_right`, `FRIDGE`, `PHONE`, `MUGS`, `PENDANT`, `HALL`, `DOOR_IN`, `lights(mode)` |

Brand pieces come from the prop library (`props.js`, re-exported by `core.js`): `makePhone` (back logo + lock screen;
`lay(x, top, z, yaw, faceDown)`, `setGlow(on)`), `makeMug`, `makeCoffeeCup`, `makeLaptop` (`setOpen(k)`), `makeShoppingBag`,
`makeBox`, `makeCerealBox`, `makeCan`, `makeBottle`, `makeTV` (`setOn(k)`), `makeMagnet`, `printOnFigure(fig, {where})`, plus
`makePoster` and `makeSign({lines})`. Custom pieces use `decal`, `badgeTex`, `wordTex`, `printMat`, and must be tagged with
`tagBrand(mesh)` / `brandRoot(group)` for the QA brand check. The mark is light artwork: straight on dark surfaces, on a dark
plate on light ones, never stretched or recoloured. The corner watermark
is drawn into every frame by `main.js` (film.json `"watermark": false` turns it off) and the camera search keeps heads out from under it.

## Figures
Capsule figures with big heads, a rim and eyes. Women: `bun` or `ponytail`. Children: `s` 0.6-0.75.
IK arms: `ikW(f, side, worldPoint, pole)` with pole vectors pointing down and out.

### Looks (js/looks.js)
- `film.json` `"look"`: `black` (default: dark body, light rim, glowing eyes) or `white` (off-white body with a soft dark rim,
  dark dot eyes and a brow stroke over each eye). `story.py` `LOOKS = {who: 'black' | 'white' | 'shadow'}` overrides one
  figure; `ST.fig(name, ...)` picks the material from `lookOf(name)`, so set code is the same for every look.
- `shadow`: the shadow self, a near-black body with a red rim and red eyes; its lines get the red caption and subtitle style.
  Add it like any figure: `F.shadow = F.shadow || ST.fig('shadow', 0xff3048, { s: 1.0 }, 1.0)`, and add it to `only(...)`,
  `dialogueCuts` actors and the `heads` map.
- Expressions: set `A.brow` (-1 angry .. 0 .. 1 worried/sad) and `A.lid` (0 open .. 1 heavy) on the Actor before
  `A.update(t)`, every frame. `blink()` hands them to `f.face`, which tilts and lifts the brows and lowers the lids.
- `updateLooks(scene, figs)` runs after each `render()`: every white figure takes its key from the strongest visible point
  or spot light near its head (so it is lit by the lamp it stands under), and in a white film the room is darkened once
  (wall and furniture colours x0.4; brand pieces, figures and emissive or basic materials untouched) and the fill lights
  (hemisphere, ambient, directional) run at 25 %. Give a white-look set its practicals (lamps, windows, screens) as point or
  spot lights; that is what makes the warm pools.
- Opening card: `OPENING = {text, key, color}` in `story.py` and an `'opening'` scene (no set) show the line on black with
  the keyword in colour, fading in and out; captions skip it.

## Actor scripts (stage.js)
```js
const A = new Actor(ST, 'ana', F.ana, { x, z, yaw, hidden: true }, [
  ['show', t, { x, z, yaw }], ['walk', t, [[x,z], [x,z]], { face: 'ben', speed: 1.1, direct, run, by }],
  ['face', t, 'ben' | yaw | [x,z], { dur }], ['sit', t, 'seatName'], ['rise', t], ['kneel', t], ['unkneel', t],
  ['place', t, { x, z, yaw }], ['hide', t] ]);
```
- Times are absolute: marks `mk(scene, 'door')`, lines `linesOf(scene)[i].start`, `lineEnd(l)`.
- Walk time = distance / speed (default 1.2 m/s). Under 0.6 m/s reads as creeping, over 2.2 m/s as sliding (QA checks it).
  Finish a walk before the line that needs the walker framed: speaker cameras are chosen at the start of the line.
- Routes go around footprints; `direct: true` skips routing (doorways, short steps). Commands must not overlap.
- `A.look = point; A.lookK = 0.7` turns the head. Talk motion comes from `env.json` (made by the build step).
- Two people talking standing: at least ~1 m apart, ideally 1.8-2.5 m with an open side for the camera.

## Physical rules
- Doors are real openings with a hinged leaf that opens before anyone passes; a figure behind a door waits 0.6 m back.
- Wall objects (posters, signs, windows) have a frame or depth and sit off the wall.
- Props follow their owner; hide a prop when its owner leaves. Thin decorative meshes get `userData.noCollide = true`.
- Pendant lamps at 2.45 m or higher where people stand.

## Camera
- `applyShot(ST, scene, cuts, t, end, pose)` with `cuts = [[t, spec], ...]`.
- Hand-made: `{name, pos, look, fov, pos2, look2, fov2, follow: 'who', short: {...}}` (moves from pos to pos2 over the shot).
- Automatic: `{who: ['ana']}` (autoCam searches round the head) or `{frame: [...], face: [...]}` (wideCam). Both refuse cameras
  inside geometry, blocked views, cut heads, someone covering the speaker, backs of heads, a foreground head filling the frame and
  heads under the watermark.
- `dialogueCuts(scene, {actors, hold, wides: [...], extra: [[t, spec]], drop: c => bool, whoFrame: {dist, dist2}})`: a cut per
  change of speaker, wides for narration, no shot under 1.8 s. The opening wide holds `hold` seconds, capped at 15 % of the scene.
  `whoFrame` gives clean singles (no over-the-shoulder): use it when two people stand close in the open.
- Hand-made shots are not searched: QA checks them for heads over 45 % of the frame, figures closer than 0.9 m and the watermark
  over a face. Snapshot every one: `python kit/snap.py <film> 12.5,14` or try a camera with `DBG='{"pos":[..],"look":[..],"fov":30}'`.
- Inserts (a hand, a page) set `insert: true` so QA accepts the speaker being out of shot.
- Never put `//` comments inside code you splice mid-line; use `/* */`.

## Look
Night palettes deep navy with one warm practical light; silhouettes read best against a lit background (windows, doorways,
lamps). `sceneFade(t, scene, in, out)` fades between scenes.
