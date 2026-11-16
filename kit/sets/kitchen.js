// SET: a home kitchen at night (built from references/new-set.md).
// PLAN
//   Size      7.0 x 5.6 m floor (x -3.5..3.5, z -3.0..2.6), ceiling 3.0 m (the figures stand ~2.4 m); the front (+z) is open.
//   Walls     back (z -3.0) with a real window opening over the sink; left (x -3.6) with an open doorway to a lit hall;
//             right (x 3.6) solid.
//   Openings  window x -2.25..-0.75, sill 1.15, head 2.15 (city at night behind it); doorway z 0.3..1.3, 2.1 m high, to a
//             1.4 m deep hall with its own light (backlights whoever stands in it).
//   Furniture counter run on the back wall (x -3.45..0.55, top 0.92) with sink, hob, kettle and upper cabinets either side
//             of the window; fridge (x 0.62..1.42); table 1.4 x 0.85 at (0.9, 0.3), top 0.75, three chairs.
//   Seats     chair_back (0.9, -0.55) faces +z (the camera side); chair_left (-0.25, 0.3) faces +x; chair_right
//             (2.05, 0.3) faces -x.
//   Light     warm pendant over the table (key, shadows), warm under-cabinet strips, cold window, warm hall light behind
//             the doorway, low fill.
//   Lanes     along the counter (z -2.3..-1.2) from the doorway to the fridge; doorway -> table left end. Nothing stands in them.
//   Cameras   16:9 wides from the open front at z 3-4, height 1.6-1.9; 9:16 wides from z 3.5-4.2, height 1.6-1.8.
//   Brand     two mugs and a cereal box on the counter, a magnet on the fridge, a shopping bag beside it, the framed poster on
//             the back wall (reads in the wide, lit by the pendant), the phone on the table (back logo up when face down).
// Useful spots: TABLE, seats chair_back / chair_left / chair_right, HALL (in the hall), DOOR_IN (just inside the doorway),
// COUNTER_AT (standing at the counter by the mugs), PHONE, MUGS, PENDANT, lights(mode) 'night' | 'dim'.
import { THREE, rng, mat, box, cyl, add, textTex, makePhone, makeMug, makeCerealBox, makeMagnet, makeShoppingBag, makePoster } from './core.js';
import { Stage } from './stage.js';

export const ST = new Stage('kitchen', { bounds: [-3.4, 3.4, -2.9, 3.4], fov: 36 });
const sc = ST.scene; sc.background = new THREE.Color(0x0a0c12); sc.fog = new THREE.Fog(0x0a0c12, 16, 40);
const XL = -3.6, XR = 3.6, ZB = -3.0, HT = 3.0;
const WALL = mat(0x4a4842, 0.92), TRIM = mat(0xd8d2c4, 0.55), WOOD = mat(0x6a4a32, 0.6), CAB = mat(0x2e3a3e, 0.55), TOP = mat(0xcfc8bc, 0.35);

// ---------- shell: tiled floor, walls with real openings, ceiling ----------
{ const tile = textTex((c, w, h) => { const R = rng(11); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const k = 150 + ((i + j) % 2) * 18 + R() * 8; c.fillStyle = `rgb(${k},${k - 6},${k - 14})`; c.fillRect(i * w / 8, j * h / 8, w / 8, h / 8); }
    c.strokeStyle = 'rgba(40,36,30,.5)'; c.lineWidth = 3; for (let i = 0; i <= 8; i++) { c.beginPath(); c.moveTo(i * w / 8, 0); c.lineTo(i * w / 8, h); c.stroke(); c.beginPath(); c.moveTo(0, i * h / 8); c.lineTo(w, i * h / 8); c.stroke(); } }, 512, 512);
  tile.wrapS = tile.wrapT = THREE.RepeatWrapping; tile.repeat.set(2.4, 2.4);
  const fl = add(sc, new THREE.Mesh(new THREE.PlaneGeometry(XR - XL, 7.2), new THREE.MeshStandardMaterial({ map: tile, roughness: 0.55 })), 0, 0, 0.6, { rx: -Math.PI / 2 }); fl.name = 'floor'; fl.receiveShadow = true;
  add(sc, new THREE.Mesh(new THREE.PlaneGeometry(XR - XL, 6.2), mat(0x3a3834, 0.95)), 0, HT, 0.1, { rx: Math.PI / 2 }).userData.shell = true; }
// back wall around the window opening (x -2.25..-0.75, y 1.15..2.15): four pieces, 0.2 thick, inner face at z -3.0
const WZ = ZB - 0.1;
for (const [w, h, x, y] of [[XL + 2.25 + 0.1, HT, (XL - 0.1 - 2.25) / 2, HT / 2], [XR + 0.1 + 0.75, HT, (XR + 0.1 - 0.75) / 2, HT / 2], [1.5, 1.15, -1.5, 0.575], [1.5, HT - 2.15, -1.5, (HT + 2.15) / 2]])
  add(sc, box(w, h, 0.2, WALL, -1), x, y, WZ, { cast: true }).name = 'back wall';
// the window: reveal, frame with depth, mullion, sill, and the city at night behind the glass
{ const g = new THREE.Group(); g.position.set(-1.5, 1.65, ZB); sc.add(g);
  for (const [w, h, x, y] of [[1.6, 0.07, 0, 0.535], [1.6, 0.07, 0, -0.535], [0.07, 1.14, -0.765, 0], [0.07, 1.14, 0.765, 0], [0.045, 1.0, 0, 0]]) add(g, box(w, h, 0.09, TRIM), x, y, -0.06);
  add(g, box(1.7, 0.05, 0.2, TRIM), 0, -0.53, 0.06);                                        // sill
  const city = textTex((c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0b1226'); gr.addColorStop(1, '#27304e'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    const R = rng(4); for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(R() * w, R() * h * 0.4, 1.5, 1.5); }
    let x = 0; while (x < w) { const bw = 40 + R() * 70, bh = h * (0.25 + R() * 0.4); c.fillStyle = '#080a12'; c.fillRect(x, h - bh, bw, bh);
      for (let yy = h - bh + 10; yy < h - 8; yy += 16) for (let xx = x + 6; xx < x + bw - 8; xx += 14) if (R() < 0.18) { c.fillStyle = R() < 0.5 ? '#ffd890' : '#ffc070'; c.fillRect(xx, yy, 7, 9); } x += bw + 4; } }, 512, 384);
  const view = add(g, new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.8), new THREE.MeshBasicMaterial({ map: city, color: 0xb0b0b0 })), 0, 0.1, -0.7); view.userData.camSkip = true;
  const glass = add(g, new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), new THREE.MeshStandardMaterial({ color: 0x9ab0c8, roughness: 0.05, transparent: true, opacity: 0.08, depthWrite: false })), 0, 0, -0.1); glass.userData.camSkip = true;
  const pot = add(g, cyl(0.07, 0.055, 0.12, mat(0xb86a48, 0.7), 40), 0.45, -0.445, 0.06, { cast: true });
  for (let i = 0; i < 7; i++) { const lf = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 12), mat(0x3a6a3a, 0.7)); lf.scale.set(0.5, 1.4, 0.3); lf.position.set(0.45 + Math.sin(i * 0.9) * 0.05, -0.32 + (i % 3) * 0.03, 0.06 + Math.cos(i * 0.9) * 0.05); lf.rotation.z = Math.sin(i * 1.7) * 0.6; g.add(lf); } }
// left wall with the doorway (z 0.3..1.3, 2.1 high) and a cased opening; a short lit hall behind it
for (const [d, z] of [[0.3 - ZB, (ZB + 0.3) / 2], [3.4 - 1.3, (1.3 + 3.4) / 2]]) add(sc, box(0.2, HT, d, WALL, -1), XL - 0.1, HT / 2, z).name = 'left wall';
add(sc, box(0.2, HT - 2.1, 1.0, WALL, -1), XL - 0.1, (HT + 2.1) / 2, 0.8);
for (const z of [0.27, 1.33]) add(sc, box(0.24, 2.12, 0.06, TRIM), XL - 0.1, 1.06, z);
add(sc, box(0.24, 0.06, 1.12, TRIM), XL - 0.1, 2.13, 0.8);
{ const hm = mat(0x5a5048, 0.95);
  add(sc, new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.2), mat(0x4a3a2e, 0.8)), XL - 0.9, 0.001, 0.8, { rx: -Math.PI / 2 });
  add(sc, box(0.15, HT, 1.4, hm, -1), XL - 1.65, HT / 2, 0.8); add(sc, box(1.4, HT, 0.15, hm, -1), XL - 0.9, HT / 2, 0.12); add(sc, box(1.4, HT, 0.15, hm, -1), XL - 0.9, HT / 2, 1.48);
  add(sc, box(1.4, 0.1, 1.4, hm, -1), XL - 0.9, HT, 0.8);
  add(sc, box(0.04, 0.5, 0.36, mat(0x2a2420, 0.6)), XL - 1.56, 1.45, 0.8);                    // a coat hook board on the hall wall
  for (const dz of [-0.1, 0.1]) add(sc, new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.45, 8, 24), mat(0x2a3448, 0.85)), XL - 1.48, 1.2, 0.8 + dz); }
export const HALL = [XL - 0.85, 0.8], DOOR_IN = [XL + 0.6, 0.8];
// right wall, solid
add(sc, box(0.2, HT, 3.4 - ZB, WALL, -1), XR + 0.1, HT / 2, (ZB + 3.4) / 2).name = 'right wall';
// walls block walking except the doorway
ST.block(XL - 0.1, (ZB + 0.3) / 2, 0.3, 0.3 - ZB, 0, 'left wall'); ST.block(XL - 0.1, (1.3 + 3.4) / 2, 0.3, 2.1, 0, 'left wall');
ST.block(XR + 0.1, 0.2, 0.3, 6.4, 0, 'right wall');
ST.walkable = (x, z, clr) => (x > XL + clr && x < XR - clr && z > ZB + clr && z < 3.4) || (x > XL - 1.55 + clr && x <= XL + clr + 0.01 && z > 0.3 + clr && z < 1.3 - clr);

// ---------- counter run on the back wall ----------
export const COUNTER = { x0: -3.45, x1: 0.55, top: 0.92, z: -2.68, d: 0.62 };
{ const cx = (COUNTER.x0 + COUNTER.x1) / 2, w = COUNTER.x1 - COUNTER.x0, zf = COUNTER.z + COUNTER.d / 2;
  add(sc, box(w, 0.1, COUNTER.d - 0.08, mat(0x1a1a1c, 0.8)), cx, 0.05, COUNTER.z - 0.04);                       // recessed kickplate
  add(sc, box(w, 0.78, COUNTER.d, CAB), cx, 0.49, COUNTER.z, { cast: true }).name = 'counter';
  add(sc, box(w + 0.04, 0.04, COUNTER.d + 0.04, TOP, 0.012), cx, COUNTER.top - 0.02, COUNTER.z + 0.01, { cast: true }).name = 'counter top';
  const hdl = mat(0xb8bcc4, 0.25, { metalness: 0.9 });
  for (let x = COUNTER.x0 + 0.25; x < COUNTER.x1; x += 0.5) {
    add(sc, box(0.47, 0.72, 0.02, CAB, 0.008), x, 0.52, zf + 0.008);
    add(sc, box(0.16, 0.014, 0.022, hdl, 0.006), x, 0.8, zf + 0.03); }
  // backsplash tiles between the counter and the upper cabinets
  const sp = textTex((c, w, h) => { c.fillStyle = '#e6e0d4'; c.fillRect(0, 0, w, h); c.strokeStyle = '#b4ab9c'; c.lineWidth = 3; for (let i = 0; i <= 16; i++) { c.beginPath(); c.moveTo(i * w / 16, 0); c.lineTo(i * w / 16, h); c.stroke(); } for (let j = 0; j <= 4; j++) { c.beginPath(); c.moveTo(0, j * h / 4); c.lineTo(w, j * h / 4); c.stroke(); } }, 1024, 256);
  for (const [x0, x1] of [[COUNTER.x0, -2.25], [-0.75, COUNTER.x1]]) { const m = add(sc, box(x1 - x0, 0.58, 0.012, new THREE.MeshStandardMaterial({ map: sp.clone(), roughness: 0.3 })), (x0 + x1) / 2, COUNTER.top + 0.29, ZB + 0.006); m.material.map.needsUpdate = true; m.material.map.repeat.set((x1 - x0) / 2, 1); m.material.map.wrapS = THREE.RepeatWrapping; }
  // sink under the window: steel rim, dark basin, gooseneck tap
  const steel = mat(0xb0b4ba, 0.25, { metalness: 0.85 });
  add(sc, box(0.66, 0.012, 0.46, steel, 0.005), -1.5, COUNTER.top + 0.006, COUNTER.z);
  add(sc, box(0.58, 0.004, 0.38, mat(0x2a2c30, 0.3, { metalness: 0.6 }), 0.002), -1.5, COUNTER.top + 0.0125, COUNTER.z);
  add(sc, cyl(0.016, 0.02, 0.24, steel, 40), -1.5, COUNTER.top + 0.12, COUNTER.z - 0.27);
  const neck = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.013, 16, 48, Math.PI), steel); neck.position.set(-1.5, COUNTER.top + 0.24, COUNTER.z - 0.18); neck.rotation.y = Math.PI / 2; sc.add(neck);
  // hob: black glass with four rings
  add(sc, box(0.6, 0.008, 0.5, mat(0x0c0c0e, 0.15, { metalness: 0.3 }), 0.004), -2.85, COUNTER.top + 0.004, COUNTER.z);
  for (const [dx, dz, r] of [[-0.14, -0.11, 0.08], [0.14, -0.11, 0.06], [-0.14, 0.12, 0.06], [0.14, 0.12, 0.08]]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0035, 8, 48), mat(0x5a5a60, 0.4)); ring.rotation.x = Math.PI / 2; ring.position.set(-2.85 + dx, COUNTER.top + 0.009, COUNTER.z + dz); sc.add(ring); }
  // kettle
  const k = new THREE.Group(); k.position.set(-2.2, COUNTER.top, COUNTER.z - 0.1); sc.add(k);
  add(k, cyl(0.075, 0.09, 0.2, mat(0xd8d4cc, 0.3), 48), 0, 0.1, 0, { cast: true }); add(k, cyl(0.04, 0.07, 0.03, mat(0xd8d4cc, 0.3), 48), 0, 0.215, 0);
  const kh = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 12, 40, Math.PI), mat(0x2a2a2a, 0.5)); kh.position.set(0, 0.2, 0); kh.rotation.z = 0; kh.rotation.y = Math.PI / 2; k.add(kh);
  ST.block(cx, COUNTER.z, w + 0.04, COUNTER.d + 0.05, 0, 'counter'); }
// upper cabinets either side of the window, with warm under-cabinet light strips
const STRIPS = [];
for (const [x0, x1] of [[COUNTER.x0, -2.4], [-0.6, COUNTER.x1]]) {
  const cx = (x0 + x1) / 2, w = x1 - x0;
  add(sc, box(w, 0.72, 0.34, CAB), cx, 1.88, ZB + 0.17, { cast: true }).name = 'upper cabinet';
  for (let x = x0 + 0.25; x < x1 - 0.1; x += 0.5) { add(sc, box(Math.min(0.47, x1 - x + 0.22), 0.68, 0.02, CAB, 0.008), x, 1.88, ZB + 0.35); add(sc, box(0.014, 0.12, 0.022, mat(0xb8bcc4, 0.25, { metalness: 0.9 }), 0.006), x + 0.18, 1.62, ZB + 0.37); }
  STRIPS.push(add(sc, box(w - 0.1, 0.012, 0.03, new THREE.MeshBasicMaterial({ color: 0xffe2b0 }), 0.004), cx, 1.515, ZB + 0.3));
  const l = new THREE.PointLight(0xffd8a8, 1.8, 2.6, 1.8); l.position.set(cx, 1.42, ZB + 0.35); sc.add(l); STRIPS.push(l); }

// ---------- fridge with a magnet, a shopping bag beside it ----------
export const FRIDGE = { x: 1.02, z: ZB + 0.36, w: 0.8, d: 0.7, h: 1.85 };
{ const g = new THREE.Group(); g.position.set(FRIDGE.x, 0, FRIDGE.z); sc.add(g);
  const body = mat(0xd4d6d8, 0.3, { metalness: 0.4 }), hdl = mat(0x9aa0a8, 0.2, { metalness: 0.9 });
  add(g, box(FRIDGE.w, FRIDGE.h, FRIDGE.d, body, 0.03), 0, FRIDGE.h / 2, 0, { cast: true }).name = 'fridge';
  add(g, box(FRIDGE.w - 0.02, 0.012, 0.01, mat(0x8a8c90, 0.4)), 0, 1.2, FRIDGE.d / 2 + 0.002);   // door split
  for (const [y, h] of [[1.52, 0.42], [0.62, 0.62]]) add(g, box(0.025, h, 0.04, hdl, 0.01), FRIDGE.w / 2 - 0.07, y, FRIDGE.d / 2 + 0.03);
  const mag = makeMagnet({ size: 0.065 }); mag.position.set(-0.12, 1.5, FRIDGE.d / 2); mag.rotation.z = 0.06; g.add(mag);
  const note = add(g, new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.17), mat(0xf4efe2, 0.9)), -0.12, 1.42, FRIDGE.d / 2 + 0.003); note.rotation.z = -0.04;   // a note under the magnet
  ST.block(FRIDGE.x, FRIDGE.z, FRIDGE.w + 0.05, FRIDGE.d + 0.05, 0, 'fridge'); }
{ const bag = makeShoppingBag(); bag.position.set(1.78, 0, ZB + 0.16); bag.rotation.y = -0.25; sc.add(bag); ST.block(1.78, ZB + 0.16, 0.4, 0.3, -0.25, 'bag'); }
// the framed poster on the back wall right of the fridge (the brand piece that reads in the wide; the pendant lights it)
export const POSTER = makePoster({ w: 0.95, h: 0.68 }); add(sc, POSTER, 2.55, 1.62, ZB + 0.005);

// ---------- table and chairs ----------
export const TABLE = { x: 0.9, z: 0.3, w: 1.4, d: 0.85, top: 0.75 };
{ add(sc, box(TABLE.w, 0.04, TABLE.d, WOOD, 0.015), TABLE.x, TABLE.top - 0.02, TABLE.z, { cast: true }).name = 'table';
  add(sc, box(TABLE.w - 0.16, 0.08, TABLE.d - 0.16, WOOD, 0.01), TABLE.x, TABLE.top - 0.08, TABLE.z);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(sc, box(0.05, TABLE.top - 0.04, 0.05, WOOD, 0.012), TABLE.x + dx * (TABLE.w / 2 - 0.07), (TABLE.top - 0.04) / 2, TABLE.z + dz * (TABLE.d / 2 - 0.07), { cast: true });
  ST.block(TABLE.x, TABLE.z, TABLE.w + 0.05, TABLE.d + 0.05, 0, 'table'); }
function chair(name, x, z, yaw) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; sc.add(g);
  add(g, box(0.44, 0.04, 0.42, WOOD, 0.012), 0, 0.44, 0, { cast: true });
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(g, box(0.035, 0.44, 0.035, WOOD, 0.01), dx * 0.19, 0.22, dz * 0.18);
  for (const dx of [-1, 1]) add(g, box(0.035, 0.5, 0.035, WOOD, 0.01), dx * 0.19, 0.69, -0.19);
  add(g, box(0.42, 0.14, 0.025, WOOD, 0.01), 0, 0.86, -0.2, { cast: true });
  ST.seat(name, x - Math.sin(yaw) * 0.02, z - Math.cos(yaw) * 0.02, 0.46, yaw, 0.42);
  ST.block(x, z, 0.46, 0.46, yaw, 'chair ' + name);
}
chair('chair_back', TABLE.x, TABLE.z - 0.85, 0);
chair('chair_left', TABLE.x - 1.15, TABLE.z, Math.PI / 2);
chair('chair_right', TABLE.x + 1.15, TABLE.z, -Math.PI / 2);

// ---------- pendant over the table: shade bottom at 2.45 m, above every head and out of the eye-line of the cameras ----------
export const PENDANT = new THREE.PointLight(0xffc88a, 8, 8, 1.5);
{ const g = new THREE.Group(); g.position.set(TABLE.x, 0, TABLE.z); sc.add(g);
  add(g, cyl(0.004, 0.004, HT - 2.73, mat(0x111111, 0.5), 20), 0, (HT + 2.73) / 2, 0);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.22, 0.26, 48, 1, true), mat(0x1c2226, 0.45, { side: THREE.DoubleSide, metalness: 0.3 })); shade.position.y = 2.58; g.add(shade);
  add(g, cyl(0.065, 0.065, 0.04, mat(0x1c2226, 0.45), 40), 0, 2.72, 0);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 32, 20), new THREE.MeshBasicMaterial({ color: 0xffe8c0 })); bulb.position.y = 2.51; g.add(bulb); bulb.userData.camSkip = true;
  PENDANT.position.set(TABLE.x, 2.42, TABLE.z); PENDANT.castShadow = true; PENDANT.shadow.mapSize.set(2048, 2048); PENDANT.shadow.bias = -0.002; PENDANT.shadow.radius = 4; sc.add(PENDANT); }

// ---------- brand on the counter: two mugs, a cereal box ----------
export const MUGS = [makeMug(), makeMug({ color: 0xc9d4c0, coffee: false })];   // light glazes: under the strip lights a dark glaze washes pale
MUGS[0].position.set(-0.3, COUNTER.top, COUNTER.z + 0.14); MUGS[0].rotation.y = 0.35; sc.add(MUGS[0]);
MUGS[1].position.set(-0.08, COUNTER.top, COUNTER.z + 0.05); MUGS[1].rotation.y = 0.1; sc.add(MUGS[1]);
export const CEREAL = makeCerealBox(); CEREAL.position.set(-2.32, COUNTER.top, COUNTER.z - 0.06); CEREAL.rotation.y = 0.12; sc.add(CEREAL);
export const COUNTER_AT = [-0.55, -1.95];                   // standing at the counter by the mugs

// ---------- lights ----------
const hemi = new THREE.HemisphereLight(0x8090b8, 0x2a2018, 0.42); sc.add(hemi);
const moon = new THREE.DirectionalLight(0x8aa4d8, 0.35); moon.position.set(-2, 4, -9); moon.target.position.set(0, 0, 0); sc.add(moon, moon.target);
const winL = new THREE.PointLight(0x7a9ad0, 1.6, 4, 1.6); winL.position.set(-1.5, 1.7, ZB + 0.4); sc.add(winL);
export const HALL_L = new THREE.PointLight(0xffd4a0, 4.5, 5, 1.6); HALL_L.position.set(XL - 0.9, 2.2, 0.8); sc.add(HALL_L);
const fill = new THREE.PointLight(0xffe0c0, 1.2, 9, 1.4); fill.position.set(0.6, 2.3, 2.6); sc.add(fill);
export function lights(mode = 'night') {
  const dim = mode === 'dim';
  PENDANT.intensity = dim ? 0 : 8; HALL_L.intensity = 4.5; fill.intensity = dim ? 0.5 : 1.2;
  for (const s of STRIPS) if (s.isLight) s.intensity = 1.8; else s.material.color.set(0xffe2b0);
}

// ---------- figures and the phone ----------
export const F = {
  ana: ST.fig('ana', 0xffe2cc, { bun: true, s: 0.95 }, 1.05),
  ben: ST.fig('ben', 0xe8ecff, { s: 1.0 }, 1.0),
};
export const PHONE = ST.track(makePhone(), 'phone'); sc.add(PHONE);
PHONE.lay(TABLE.x + 0.15, TABLE.top, TABLE.z - 0.27, 0.3, true);       // face down on the table, back logo up
export function only(...names) { const keep = new Set(names); for (const [n, f] of Object.entries(ST.figs)) f.g.visible = keep.has(n); }
