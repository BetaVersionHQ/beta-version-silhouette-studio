# Build any location

The sets in `kit/sets/` (room, motel, laundromat, kitchen) are starting points, not a limit. When the story needs a place
that is not there (a bus stop, a hospital corridor, a rooftop, a classroom), build it as a new world module. Read
`engine-guide.md` for the module pattern and camera tools; this file is the recipe. The kitchen (`kit/sets/kitchen.js`)
was built from it and is the closest example of an interior; the motel is the example of an exterior.

## 1. Story place -> set plan
Write the plan as a comment block at the top of the module before any geometry. Answer every line:

| Item | What to decide |
|---|---|
| Size | floor footprint in metres (a kitchen ~7 x 5.5, a bedroom ~4.5 x 4, a street ~20 x 12). The figures are ~2.4 m tall (big heads: a standing head centre is ~2.2 m, a seated one ~1.8 m), so ceilings are 3.0 m |
| Walls | which walls exist. Leave the side the cameras shoot from open (usually +z) |
| Openings | doors, arches, windows: where, how wide (doors 0.9-1.0 m), what is behind each one |
| Furniture | the pieces the story uses first (the table they sit at), then 3-6 pieces that make the place read |
| Seats | every place someone sits: hip spot, seat height (chair 0.46, sofa 0.45, stool 0.75), facing |
| Light mood | one motivated key (a lamp, a window, a sign), one colder fill, something lit behind the actors |
| Walk lanes | the paths people take (door -> table, counter -> chair): at least 0.9 m clear, nothing standing in them |
| Camera room | where the wide shots stand in 16:9 AND in 9:16. 9:16 needs height: leave 3+ m of clear floor in front of the action |
| Brand | which library props go where (section 4) and which one reads in the wide |

## 2. Build checklist
- **Coordinates:** y up, metres, the floor at y 0. Put the action near the origin; keep `bounds` tight around the floor.
- **Finished shapes:** `box()` gives every box a bevel; round things use 40+ segments (`cyl(..., 48)`). No raw cubes.
- **Wall objects have depth:** frames, sills, cabinets and posters sit off the wall with a real thickness. A window is a
  frame + sill + a lit pane set back into the wall, never a flat picture on it.
- **Doors are real:** an opening in the wall (block the wall on both sides of it, leave the gap), a hinged leaf that is
  open before anyone passes (`setDoor(k)`), and a figure behind it waits 0.6 m back.
- **Entrances lead somewhere:** behind every door or arch build a short recessed room (floor, far wall, side walls) with
  its own light, so the doorway reads as depth and backlights whoever stands in it.
- **Lamps:** pendants hang with the shade bottom at 2.45 m or higher everywhere, over tables too (a 2.0 m pendant blocked
  a standing head in the wide and threw a seated head's shadow as a big disc on the wall). No lamp between a camera and a face.
- **No props in walk lanes.** Floor props (bags, bins, boxes) go against walls or under tables, each with a footprint.
- **Footprints for everything people walk around:** `ST.block(x, z, w, d, ry, 'tag')` for boxes, `ST.blockC(x, z, r)`
  for round things, and solid walls blocked except at their openings. Add `ST.walkable = (x, z, clr) => ...` when the
  floor is not a rectangle.
- **Surfaces at real heights:** counters 0.92, tables 0.75, coffee tables 0.36-0.42, desks 0.74, shelves 0.9-1.8.
- **Lighting:** silhouettes need light behind them: windows, lit doorways, under-cabinet strips, a lamp on the back wall.
  Shadows on from the key light only (`castShadow` on one light).
- **Textures:** canvas textures (`textTex`) for tiles, signs and notices. Text you write must be original, never a real
  company's name or logo.

## 3. What a world module must export
```js
export const ST = new Stage('kitchen', { bounds: [x0, x1, z0, z1], fov: 36 });   // walkable box; camera search area
ST.block(...); ST.blockC(...);                    // footprints (QA "inside the counter" checks and walk routing use them)
ST.seat('name', x, z, top, yaw, front);           // seats: Actor ['sit', t, 'name'] and seatPose read them
export const F = { ana: ST.fig('ana', 0xffe2cc, { bun: true, s: 0.95 }, 1.05), ben: ST.fig('ben', 0xe8ecff, {}, 1.0) };
export const PHONE = ST.track(makePhone(), 'phone');   // anything that moves is tracked (QA checks it rests or is held)
export function only(...names) { ... }            // show only the figures a scene uses
export const DOOR, setDoor, DOOR_IN, DOOR_OUT ... // openings and the spots on each side of them
export const LAMP, lights(mode) ...               // lights a scene animates
```
The film's `js/set_<name>.js` then stages it and exports `render(t, sname, R)` and `FIGS = F` (footsteps and QA find the
figures through it). Name the figures the way the story's CHARS do. Put the module in `kit/sets/` to share it, or in the
film's `js/` folder for a one-off (the film's copy wins).

## 4. Brand pieces (required)
- **At least 2 per set from the prop library** (`props.js` through `core.js`): `makePhone`, `makeMug`, `makeCoffeeCup`,
  `makeLaptop`, `makeShoppingBag`, `makeBox`, `makeCerealBox`, `makeCan`, `makeBottle`, `makeTV`, `makeMagnet`, and the wall
  pieces `makePoster` and `makeSign` (shop signs, menus, price boards, with `lines`).
- **One of them reads in a wide shot:** a poster, a sign, a TV or a box big enough to be 36 px+ on screen in the wide
  (QA warns otherwise), placed where the key or a practical light hits it.
- **Props people hold come from the library:** phones, cups, laptops and bags are branded automatically, so never build
  your own phone or mug. Held props (phone, mug, cups, can, bottle) are built at 1.3x real size to suit the figures' big
  hands (`scale` changes it). A character who wears the brand gets `printOnFigure(F.ben, { where: 'chest' })`.
- The mark is light artwork: print it straight on dark surfaces, on a dark plate on light ones (the factories do this).
  Never stretch, recolour or crop it; never put it on a real company's product or sign.
- **QA:** every staged scene fails unless at least one brand piece is in view (12 px+, facing the lens, not hidden), and
  warns when a brand piece covers a face. Tag custom brand meshes with `tagBrand(mesh)` and their group with
  `brandRoot(group)` or the check cannot see them.

## 5. Test loop
1. A one-scene test film: `python kit/new_film.py _test --format short`, a story with one scene in the new set, then
   `python kit/make.py films/_test build --placeholder voice` (or real voices). `--starter kitchen-demo` copies a small
   one-scene example to start from.
2. Stills before anything else: `python kit/snap.py films/_test 1,4,8` in both formats (change `film.json` `"format"`).
   Look at them at small size: does the place read, is the floor lit, are faces readable, does a brand piece read?
3. Try cameras with `DBG='{"pos":[x,y,z],"look":[x,y,z],"fov":40}'` before writing them into the shot list.
4. `make.py ... sound qa` and fix every fail: walking into furniture means a missing or wrong footprint; "camera
   inside" means a wall where the camera search looks; "no in-world brand piece" means the props are out of the shots.
5. Read `qa/sheets/*.jpg` (both formats), then `render --seconds 10` and watch it once.

## Traps found building the kitchen
- A seated figure reaches about 0.75 m from the shoulder: put anything they pick up within 0.35 m of the table edge
  in front of them.
- Props picked up from a table: keep them resting until the hand arrives, then follow the hand (`holdAt`), or QA reports
  a floating prop.
- The phone's back logo only shows when it lies face down (`phone.lay(x, top, z, yaw, true)`) or is held up facing its
  owner; lying screen up it shows the lock screen once `setGlow(true)`.
- Upper cabinets and pendant shades block high cameras: try every hand-made wide at 9:16 too, which sits higher.
- Two people near each other: give `dialogueCuts` a `whoFrame: { dist, dist2 }` so speaker shots are framed from in front
  of the speaker, and stand the second person at least 1.2 m to the side, or one head covers the other.
- A prop insert with a normal lens fills the frame with the figure's body (they are big) and keeps the prop tiny. Use a
  long lens (fov 15-22) from 1.5-2 m on the prop where it rests, aim it at the prop every frame as it is lifted, and cap
  the aim height so the head never enters the top of the frame (QA fails a head bigger than the frame).
- Dark glossy glazes under bright strip lights render pale; the mark still reads because mugs always print on a plate,
  but light glazes look cleaner.
- Prove the mark reads: `DBG` a close still of each hero prop (phone back, mug) as well as the 1 fps contact sheet.
