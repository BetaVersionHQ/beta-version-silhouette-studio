// SET: a coin laundromat (public interior). Lino floor, a row of front-loaders on the back wall, stacked dryers on the
// left wall, a folding table in the middle, plastic chairs under the shop window, a glass door to the street, a change
// machine and the lit Beta Version price board on the right wall (brand in the world). lights('day'|'dusk'|'night').
// Useful spots: TABLE, seats ch_-2.6 / ch_-1.8 / ch_-1 (chairs facing the room), washer_top, DOOR_OUT / DOOR_IN.
import { THREE, rng, mat, box, cyl, add, textTex, makeSign, makeBrandBox } from './core.js';
import { Stage } from './stage.js';
import { glowSprite } from './util.js';

export const ST = new Stage('laundromat', { bounds: [-5, 5, -4, 5], fov: 36 });
const sc = ST.scene; sc.background = new THREE.Color(0x0c0e14);
const XW = 5, ZB = -4, ZF = 4, HT = 3.2;
// the room: lino floor, walls, ceiling, a blue stripe, the shop front (low wall, glass, mullions) and the glass door
{ const lino = textTex((c, w, h) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { c.fillStyle = (i + j) % 2 ? '#d8d2c2' : '#b8c4c0'; c.fillRect(i * w / 8, j * h / 8, w / 8, h / 8); } const R = rng(3); for (let k = 0; k < 600; k++) { c.fillStyle = `rgba(80,70,60,${R() * 0.08})`; c.fillRect(R() * w, R() * h, 3, 3); } }, 512, 512);
  lino.wrapS = lino.wrapT = THREE.RepeatWrapping; lino.repeat.set(3, 3);
  const fl = add(sc, new THREE.Mesh(new THREE.PlaneGeometry(2 * XW, ZF - ZB + 2), new THREE.MeshStandardMaterial({ map: lino, roughness: 0.5 })), 0, 0, 1, { rx: -Math.PI / 2 }); fl.name = 'floor'; fl.receiveShadow = true;
  const wm = mat(0xc8d8d0, 0.9);
  for (const [w, x, z, ry] of [[2 * XW, 0, ZB, 0], [ZF - ZB, -XW, 0, Math.PI / 2], [ZF - ZB, XW, 0, -Math.PI / 2]]) { const m = add(sc, new THREE.Mesh(new THREE.PlaneGeometry(w, HT), wm), x, HT / 2, z, { ry }); m.receiveShadow = true; m.userData.shell = true; }
  add(sc, new THREE.Mesh(new THREE.PlaneGeometry(2 * XW, ZF - ZB), mat(0xe8ece8, 0.9)), 0, HT, 0, { rx: Math.PI / 2 }).userData.shell = true;
  for (const [w, x, z, ry] of [[2 * XW, 0, ZB + 0.01, 0], [ZF - ZB, -XW + 0.01, 0, Math.PI / 2], [ZF - ZB, XW - 0.01, 0, -Math.PI / 2]]) add(sc, new THREE.Mesh(new THREE.PlaneGeometry(w, 0.18), mat(0x3a7ab8, 0.6)), x, 2.1, z, { ry });
  const fr = mat(0x8a9aa0, 0.4, { metalness: 0.5 });
  add(sc, box(8.0, 0.5, 0.12, wm), -1.0, 0.25, ZF).userData.shell = true; add(sc, box(1.0, 0.5, 0.12, wm), 4.5, 0.25, ZF);
  add(sc, box(2 * XW, 0.6, 0.12, wm), 0, HT - 0.3, ZF).userData.shell = true;
  for (const x of [-5, -3, -1, 1, 3, 4]) add(sc, box(0.08, HT - 0.6, 0.1, fr), x, (HT - 0.6) / 2, ZF);
  add(sc, box(8.0, 0.06, 0.1, fr), -1.0, 0.5, ZF);
  const glassM = new THREE.MeshStandardMaterial({ color: 0x9ab8c8, roughness: 0.05, transparent: true, opacity: 0.16, depthWrite: false });
  add(sc, box(8.0, HT - 1.1, 0.02, glassM), -1.0, 0.5 + (HT - 1.1) / 2, ZF); add(sc, box(1.0, HT - 1.1, 0.02, glassM), 4.5, 0.5 + (HT - 1.1) / 2, ZF); }
ST.block(-1.0, ZF + 0.05, 8.0, 0.2, 0, 'front wall'); ST.block(4.5, ZF + 0.05, 1.0, 0.2, 0, 'front wall');
// window lettering (reads correctly from the street) and a neon OPEN sign
{ const t = textTex((c, w, h) => { c.clearRect(0, 0, w, h); c.save(); c.translate(w, 0); c.scale(-1, 1); c.fillStyle = 'rgba(255,255,255,0.85)'; c.font = 'bold 110px Inter'; c.textAlign = 'center'; c.fillText('SUDS & BUBBLES', w / 2, 130); c.font = '54px Inter'; c.fillText('COIN LAUNDRY · OPEN 7 AM - 10 PM', w / 2, 210); c.restore(); }, 1400, 240);
  add(sc, new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.72), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })), -1.5, 2.3, ZF - 0.03, { ry: Math.PI }); }
const NEON = (() => { const t = textTex((c, w, h) => { c.clearRect(0, 0, w, h); c.save(); c.translate(w, 0); c.scale(-1, 1); c.strokeStyle = '#ff4a7a'; c.lineWidth = 10; c.font = 'bold 120px Inter'; c.textAlign = 'center'; c.strokeText('OPEN', w / 2, 140); c.restore(); }, 512, 200);
  const m = add(sc, new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.35), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, color: 0xffffff })), 2.0, 1.5, ZF - 0.06, { ry: Math.PI }); m.userData.camSkip = true; return m; })();
const neonL = new THREE.PointLight(0xff4a7a, 0, 3.5, 1.6); neonL.position.set(2.0, 1.5, ZF - 0.4); sc.add(neonL);
// the glass door (x 3.0 - 4.0 in the front wall); DOOR_OUT is on the pavement, DOOR_IN the first step inside
const metal = mat(0x6a7a80, 0.4, { metalness: 0.6 });
export const DOOR = (() => { const g = new THREE.Group(); add(g, box(0.06, 2.3, 0.06, metal), 0.03, 1.15, 0); add(g, box(0.06, 2.3, 0.06, metal), 0.95, 1.15, 0);
  add(g, box(0.95, 0.08, 0.06, metal), 0.49, 2.26, 0); add(g, box(0.95, 0.12, 0.06, metal), 0.49, 0.06, 0);
  add(g, box(0.88, 2.1, 0.02, new THREE.MeshStandardMaterial({ color: 0x9ab8c8, roughness: 0.05, transparent: true, opacity: 0.2, depthWrite: false })), 0.49, 1.15, 0);
  add(g, box(0.4, 0.04, 0.04, mat(0xc0c0c0, 0.3, { metalness: 0.8 })), 0.75, 1.05, -0.05);
  g.position.set(3.0, 0, ZF); sc.add(g); return g; })();
export const DOOR_OUT = [3.5, ZF + 1.2], DOOR_IN = [3.5, ZF - 0.9];
export function setDoor(k) { DOOR.rotation.y = -1.4 * k; }   // swings out onto the pavement
// the street outside: pavement, the road, a building across it
const STREET = (() => { const g = new THREE.Group(); sc.add(g);
  add(g, new THREE.Mesh(new THREE.PlaneGeometry(30, 3), mat(0x8a8a86, 0.9, { fog: false })), 0, 0.0, ZF + 1.5, { rx: -Math.PI / 2 }); add(g, new THREE.Mesh(new THREE.PlaneGeometry(30, 8), mat(0x3a3a3c, 0.9, { fog: false })), 0, -0.02, ZF + 7, { rx: -Math.PI / 2 });
  const facade = textTex((c, w, h) => { c.fillStyle = '#7a5a4a'; c.fillRect(0, 0, w, h); for (let i = 0; i < 10; i++) for (let j = 0; j < 4; j++) { c.fillStyle = '#2a2a30'; c.fillRect(20 + i * 100, 30 + j * 120, 60, 80); } }, 1024, 512);
  const fm = new THREE.MeshBasicMaterial({ map: facade, fog: false }); add(g, new THREE.Mesh(new THREE.PlaneGeometry(30, 14), fm), 0, 7, ZF + 11, { ry: Math.PI });
  const sky = add(g, new THREE.Mesh(new THREE.PlaneGeometry(60, 20), new THREE.MeshBasicMaterial({ color: 0x9ac0e0, fog: false })), 0, 18, ZF + 12, { ry: Math.PI }); sky.userData.camSkip = true;
  const lamp = new THREE.PointLight(0xffb060, 0, 10, 1.5); lamp.position.set(-2, 3.5, ZF + 2.5); g.add(lamp);
  add(g, cyl(0.06, 0.08, 4, mat(0x2a2a2a, 0.5), 10), -2, 2, ZF + 2.8); const bulb = glowSprite('rgba(255,190,110,1)', 0.8); bulb.position.set(-2, 3.9, ZF + 2.6); g.add(bulb);
  return { g, fm, sky, lamp, bulb }; })();
// the machines: front-loaders with round glass doors and tumbling clothes
const steel = mat(0xe8eaea, 0.35, { metalness: 0.3 }), dark = mat(0x2a2e30, 0.5), glassDoor = new THREE.MeshStandardMaterial({ color: 0x3a4a5a, roughness: 0.1, metalness: 0.2 });
export const DRUMS = [];
function washer(x, y, z, ry, w = 0.7) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; sc.add(g);
  add(g, box(w, 0.92, 0.7, steel, 0.03), 0, 0.46, 0, { cast: true }); add(g, box(w - 0.02, 0.1, 0.04, dark, 0.01), 0, 0.84, 0.35);
  add(g, new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.035, 10, 32), mat(0xb8bcbe, 0.3, { metalness: 0.7 })), 0, 0.45, 0.36);
  const drum = add(g, new THREE.Mesh(new THREE.CircleGeometry(0.2, 32), glassDoor), 0, 0.45, 0.365); DRUMS.push(drum);
  const clothes = add(g, new THREE.Mesh(new THREE.CircleGeometry(0.14, 20), mat([0xc85a5a, 0x5a8ac8, 0xe8d8a0, 0x7ac88a][DRUMS.length % 4], 0.8)), 0.04, 0.4, 0.355); drum.userData.clothes = clothes;
  for (let i = 0; i < 3; i++) add(g, new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: i ? 0x40ff80 : 0xff5040 })), -0.2 + i * 0.05, 0.84, 0.375);
  return g; }
const WX = [-3.85, -3.1, -2.35, -1.6, -0.85, -0.1, 0.65, 1.4, 2.15, 2.9];
for (const x of WX) washer(x, 0, ZB + 0.4, 0);
ST.block(-0.475, ZB + 0.4, 7.6, 0.75, 0, 'washers');
ST.seat('washer_top', -0.1, ZB + 0.55, 0.93, 0, 0.5);
for (const z of [-2.6, -1.8, -1.0, -0.2, 0.6, 1.4]) { washer(-XW + 0.4, 0, z, Math.PI / 2, 0.76); washer(-XW + 0.4, 0.94, z, Math.PI / 2, 0.76); }
ST.block(-XW + 0.4, -0.6, 0.75, 4.8, 0, 'dryers');
// spin the drums: call from render with the time (faster for 'spin', slow tumble otherwise)
export function machines(t, k = 1) { DRUMS.forEach((d, i) => { const c = d.userData.clothes; if (!c) return; const a = t * (2.2 + (i % 3) * 0.6) * k + i; c.position.x = 0.04 * Math.cos(a); c.position.y = 0.45 + 0.05 * Math.sin(a) - 0.05; c.rotation.z = a; }); }
// the folding table with towel stacks, a basket, and a Beta Version box of soap on the table
export const TABLE = { x: 0.6, z: 0.2, w: 2.4, d: 0.9, top: 0.9 };
{ add(sc, box(TABLE.w, 0.06, TABLE.d, mat(0xe8e2d0, 0.5), 0.02), TABLE.x, TABLE.top - 0.03, TABLE.z, { cast: true });
  add(sc, box(TABLE.w - 0.1, 0.04, TABLE.d - 0.1, mat(0x8a8e90, 0.4, { metalness: 0.5 })), TABLE.x, 0.2, TABLE.z);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(sc, cyl(0.025, 0.025, TABLE.top - 0.06, mat(0x8a8e90, 0.4, { metalness: 0.6 }), 10), TABLE.x + dx * (TABLE.w / 2 - 0.08), (TABLE.top - 0.06) / 2, TABLE.z + dz * (TABLE.d / 2 - 0.08));
  const tc = [0xf4f0e8, 0x8ab8d8, 0xe8a8a8, 0xf4f0e8, 0xc8d8a0];
  for (let s = 0; s < 2; s++) for (let i = 0; i < 4 + s; i++) add(sc, box(0.42, 0.06, 0.32, mat(tc[(i + s) % 5], 0.95), 0.025), TABLE.x + 0.4 + s * 0.48, TABLE.top + 0.03 + i * 0.06, TABLE.z - 0.15);
  const soap = makeBrandBox(0.34, 0.24, 0.22); add(sc, soap, TABLE.x - 0.55, TABLE.top, TABLE.z + 0.1); soap.rotation.y = 0.2;
  const basket = new THREE.Group(); basket.position.set(2.7, 0, -2.6); ST.blockC(2.7, -2.6, 0.3, 'basket'); sc.add(basket);
  add(basket, cyl(0.26, 0.22, 0.3, mat(0x5a8ac8, 0.6), 24), 0, 0.15, 0, { cast: true }); add(basket, new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xe8e0d0, 0.95)), 0, 0.26, 0);
  ST.block(TABLE.x, TABLE.z, TABLE.w + 0.1, TABLE.d + 0.1, 0, 'table'); }
// plastic chairs under the window (facing into the room) and a bin at the end of the row
for (const x of [-2.6, -1.8, -1.0]) { const g = new THREE.Group(); g.position.set(x, 0, 3.25); g.rotation.y = Math.PI; sc.add(g); const pm = mat(0xe86a3a, 0.5);
  add(g, box(0.46, 0.04, 0.44, pm, 0.02), 0, 0.44, 0, { cast: true }); add(g, box(0.46, 0.4, 0.04, pm, 0.02), 0, 0.68, -0.21, { rx: -0.1 });
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(g, cyl(0.012, 0.012, 0.44, mat(0x8a8a8a, 0.4, { metalness: 0.7 }), 8), dx * 0.2, 0.22, dz * 0.19);
  ST.seat(`ch_${x}`, x, 3.25, 0.46, Math.PI, 0.42); }
ST.block(-1.8, 3.25, 2.1, 0.5, 0, 'chairs');
{ add(sc, cyl(0.17, 0.14, 0.5, mat(0x5a6a6a, 0.6), 24), -3.25, 0.25, 3.35, { cast: true }); add(sc, new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 6, 24), mat(0x4a5a5a)), -3.25, 0.5, 3.35, { rx: Math.PI / 2 }); ST.blockC(-3.25, 3.35, 0.22, 'bin'); }
// the right wall: change machine, notice board, and the lit price board (brand header + prices)
{ add(sc, box(0.5, 1.5, 0.4, mat(0x3a5a8a, 0.5), 0.03), XW - 0.25, 0.75, -2.6, { cast: true }); add(sc, box(0.3, 0.2, 0.02, new THREE.MeshBasicMaterial({ color: 0x9ae0ff })), XW - 0.46, 1.15, -2.6, { ry: -Math.PI / 2 });
  const nb = textTex((c, w, h) => { c.fillStyle = '#b8945a'; c.fillRect(0, 0, w, h); const R = rng(8); for (let i = 0; i < 14; i++) { c.fillStyle = ['#fff', '#ffe08a', '#a8d8ff', '#ffb8c8'][i % 4]; c.save(); c.translate(20 + R() * (w - 80), 20 + R() * (h - 80)); c.rotate((R() - 0.5) * 0.3); c.fillRect(0, 0, 50 + R() * 30, 60 + R() * 20); c.restore(); } }, 512, 320);
  add(sc, new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.65), new THREE.MeshStandardMaterial({ map: nb })), XW - 0.02, 1.6, 1.4, { ry: -Math.PI / 2 }); ST.block(XW - 0.25, -2.6, 0.5, 0.4, 0, 'change'); }
export const BOARD = makeSign({ w: 1.5, h: 1.05, depth: 0.08, glow: 0.9, lines: [['WASH', '$3.50'], ['DRY · 10 MIN', '$1.00'], ['SOAP', '$1.25']] });
BOARD.position.set(XW - 0.01, 1.75, -0.6); BOARD.rotation.y = -Math.PI / 2; sc.add(BOARD);
ST.walkable = (x, z, clr) => x > -XW + clr && x < XW - clr && z > ZB + clr && (z < ZF - clr || (x > 3.0 + clr && x < 4.0 - clr && z < ZF + 1.5));
// lights: fluorescent tubes, a key over the table, the window light by time of day
const TUBES = []; for (const x of [-2.5, 0.5, 3.0]) for (const z of [-2, 1.5]) TUBES.push(add(sc, box(1.2, 0.05, 0.14, new THREE.MeshBasicMaterial({ color: 0xf4fbff })), x, HT - 0.04, z));
const tubeL = [-2.5, 0.5, 3.0].flatMap(x => [-2, 1.5].map(z => { const l = new THREE.PointLight(0xe8f4ff, 4, 9, 1.4); l.position.set(x, HT - 0.25, z); sc.add(l); return l; }));
const hemi = new THREE.HemisphereLight(0xe8f0ff, 0x8a8478, 0.4); sc.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d8, 0); sun.position.set(-6, 6, 14); sun.target.position.set(0, 0, 0); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 }); sc.add(sun, sun.target);
const keyL = new THREE.SpotLight(0xfff4e8, 6, 12, 0.8, 0.6, 1.2); keyL.position.set(1.5, HT - 0.3, 2.0); keyL.target.position.set(0, 0, 0); keyL.castShadow = true; keyL.shadow.mapSize.set(1024, 1024); sc.add(keyL, keyL.target);
export function lights(mode = 'night', flicker = 0, t = 0) {
  const day = mode === 'day', dusk = mode === 'dusk', night = mode === 'night';
  sun.intensity = day ? 1.6 : dusk ? 0.7 : 0; sun.color.setHex(dusk ? 0xffa060 : 0xfff0d8);
  STREET.sky.material.color.setHex(day ? 0x9ac0e0 : dusk ? 0x6a5a8a : 0x0a1020); STREET.fm.color.setScalar(night ? 0.2 : dusk ? 0.5 : 0.95);
  STREET.lamp.intensity = night ? 3 : dusk ? 1.5 : 0; STREET.bulb.visible = !day;
  const fl = 1 - flicker * (Math.sin(t * 37) > 0.7 ? 0.5 : 0);
  for (const l of tubeL) l.intensity = (night ? 3.2 : 2.4) * fl; for (const m of TUBES) m.material.color.setScalar(fl);
  hemi.intensity = day ? 0.55 : dusk ? 0.42 : 0.3; neonL.intensity = night || dusk ? 1.2 : 0.4; keyL.intensity = night ? 5 : 3;
}
export const F = {
  ana: ST.fig('ana', 0xffe2cc, { bun: true, s: 0.95 }, 1.05),
  ben: ST.fig('ben', 0xe8ecff, { s: 1.0 }, 1.0),
};
export function only(...names) { const keep = new Set(names); for (const [n, f] of Object.entries(ST.figs)) f.g.visible = keep.has(n); }
