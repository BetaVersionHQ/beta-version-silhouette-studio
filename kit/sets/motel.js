// SET: a roadside motel at night. A one-storey row of rooms facing +z with a covered walkway, the parking lot, the
// office at the +x end, an ice machine, a sodium lamp over the lot, the desert and a starry sky. The tall roadside sign
// carries the MOTEL neon and a lit Beta Version sign box under it (brand in the world).
// Useful spots: ROOM_DOORS (x of each door, z = 0), LOT (an open patch of the lot), ICE, SIGN.
import { THREE, V, rng, mat, box, cyl, add, textTex, makeSign, makeCan } from './core.js';
import { Stage } from './stage.js';
import { makeSky, glowSprite, sandTex, makeSage, makePole } from './util.js';

export const ST = new Stage('motel', { bounds: [-16, 18, -2, 24], fov: 36 });
const sc = ST.scene; ST.cam.far = 1500;
sc.fog = new THREE.Fog(0x0a0e18, 60, 500);
export const SKY = makeSky(sc, { top: 0x05070f, mid: 0x0d1424, low: 0x1c2232, stars: 1800 });
const ROW = { x0: -13, x1: 7, d: 7, h: 3.2 }, WALK = 2.4, OFF = { x0: 7, x1: 12, d: 7 };
// ground: the desert, the lot with stall lines, the walkway, the road
{ const sand = sandTex('#6a5a48', 8); sand.repeat.set(80, 80);
  const g = add(sc, new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ map: sand, roughness: 1 })), 0, -0.005, 0, { rx: -Math.PI / 2 }); g.receiveShadow = true; g.name = 'ground'; g.userData.shell = true;
  const asph = textTex((c, w, h) => { c.fillStyle = '#2e2e30'; c.fillRect(0, 0, w, h); const R = rng(6); for (let i = 0; i < 5000; i++) { const v = 40 + R() * 50; c.fillStyle = `rgba(${v},${v},${v},0.5)`; c.fillRect(R() * w, R() * h, 2, 2); }
    c.fillStyle = 'rgba(230,230,220,0.8)'; for (let i = 0; i <= 10; i++) c.fillRect(i * w / 10 - 2, 0, 4, h * 0.42); }, 1024, 512);
  const lot = add(sc, new THREE.Mesh(new THREE.PlaneGeometry(30, 15), new THREE.MeshStandardMaterial({ map: asph, roughness: 0.9 })), -3, 0.004, WALK + 7.5, { rx: -Math.PI / 2 }); lot.receiveShadow = true; lot.name = 'lot';
  const wk = add(sc, new THREE.Mesh(new THREE.PlaneGeometry(OFF.x1 - ROW.x0 + 0.6, WALK), mat(0x9a948a, 0.9)), (ROW.x0 + OFF.x1) / 2, 0.006, WALK / 2, { rx: -Math.PI / 2 }); wk.receiveShadow = true; wk.name = 'walkway';
  const road = add(sc, new THREE.Mesh(new THREE.PlaneGeometry(900, 7.4), mat(0x343436, 0.85)), 0, 0.004, 22, { rx: -Math.PI / 2 }); road.receiveShadow = true;
  const R = rng(19); for (let i = 0; i < 50; i++) { const a = R() * 6.28, r = 22 + R() * 70, s = makeSage(i, 0.8 + R()); s.position.set(Math.sin(a) * r, 0, Math.cos(a) * r); if (Math.abs(s.position.z - 22) > 6) sc.add(s); }
  const p1 = makePole(8); p1.position.set(-20, 0, 26); sc.add(p1); const p2 = makePole(8); p2.position.set(30, 0, 26); sc.add(p2); }
// the building: stucco row, office, roof over the walkway on posts, doors with numbers, curtained windows
export const ROOM_DOORS = [];
const ROOMS = [];
{ const stucco = mat(0xd8b898, 0.95), trim = mat(0x3a6a5a, 0.6), roof = mat(0x8a4a3a, 0.8);
  add(sc, box(ROW.x1 - ROW.x0, ROW.h, ROW.d, stucco, 0.02), (ROW.x0 + ROW.x1) / 2, ROW.h / 2, -ROW.d / 2, { cast: true });
  add(sc, box(OFF.x1 - OFF.x0, ROW.h + 0.6, OFF.d, mat(0xe0c8a8, 0.95), 0.02), (OFF.x0 + OFF.x1) / 2, (ROW.h + 0.6) / 2, -OFF.d / 2, { cast: true });
  add(sc, box(OFF.x1 - ROW.x0 + 0.6, 0.18, WALK + 0.4, roof, 0.02), (ROW.x0 + OFF.x1) / 2, ROW.h - 0.1, WALK / 2 - 0.1, { cast: true });
  for (let x = ROW.x0 + 0.4; x <= OFF.x1; x += 3.2) add(sc, cyl(0.07, 0.07, ROW.h - 0.2, mat(0xe8e0d0, 0.6), 12), x, (ROW.h - 0.2) / 2, WALK - 0.15, { cast: true });
  const R = rng(3);
  for (let i = 0; i < 6; i++) { const x = ROW.x0 + 1.8 + i * 3.3; ROOM_DOORS.push(x);
    add(sc, box(0.95, 2.15, 0.06, trim, 0.01), x, 1.075, 0.03);
    add(sc, new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.14), new THREE.MeshBasicMaterial({ map: textTex((c, w, h) => { c.fillStyle = '#e8d8a8'; c.fillRect(0, 0, w, h); c.fillStyle = '#2a2a2a'; c.font = 'bold 48px Inter'; c.textAlign = 'center'; c.fillText(String(i + 1), w / 2, 52); }, 96, 64) })), x, 1.75, 0.07);
    const lit = R() < 0.4; const wm = new THREE.MeshBasicMaterial({ color: lit ? 0xffc890 : 0x1a1a22 }); ROOMS.push({ x, lit, wm });
    add(sc, new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.9), wm), x + 1.3, 1.5, 0.01);
    add(sc, box(1.4, 0.06, 0.1, trim), x + 1.3, 1.03, 0.04);
    add(sc, new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe0a0 })), x - 0.7, 2.3, 0.1); }
  add(sc, new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.4), new THREE.MeshBasicMaterial({ color: 0xffd8a0 })), 10.3, 1.55, 0.01);
  add(sc, box(0.95, 2.15, 0.06, mat(0x6a4a2a, 0.7), 0.01), 8.0, 1.075, 0.03);
  add(sc, new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.36), new THREE.MeshBasicMaterial({ map: textTex((c, w, h) => { c.fillStyle = '#1a2a2a'; c.fillRect(0, 0, w, h); c.fillStyle = '#7af0d8'; c.font = 'bold 60px Inter'; c.textAlign = 'center'; c.fillText('OFFICE', w / 2, 66); }, 320, 80) })), 9.5, 2.65, 0.02);
  add(sc, box(0.8, 1.5, 0.7, mat(0xd8dce0, 0.4, { metalness: 0.3 }), 0.04), 6.2, 0.75, 0.45, { cast: true });
  add(sc, new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.22), new THREE.MeshBasicMaterial({ map: textTex((c, w, h) => { c.fillStyle = '#2a5aa8'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = 'bold 54px Inter'; c.textAlign = 'center'; c.fillText('ICE', w / 2, 60); }, 192, 72) })), 6.2, 1.25, 0.81); }
export const ICE = [6.2, 0.45];
// a branded soda can someone left on top of the ice machine (props.js)
export const CAN = makeCan(); add(sc, CAN, 6.0, 1.5, 0.62); CAN.rotation.y = 0.3;
ST.block((ROW.x0 + OFF.x1) / 2, -ROW.d / 2, OFF.x1 - ROW.x0, ROW.d, 0, 'motel'); ST.block(ICE[0], ICE[1], 0.9, 0.8, 0, 'ice machine');
for (let x = ROW.x0 + 0.4; x <= OFF.x1; x += 3.2) ST.blockC(x, WALK - 0.15, 0.12, 'post');
// the roadside sign: MOTEL neon on top, the lit Beta Version sign box under it, VACANCY at the bottom
export const SIGN = (() => { const g = new THREE.Group(); g.position.set(9.5, 0, 10.5); g.rotation.y = -0.45; sc.add(g);
  add(g, cyl(0.16, 0.2, 7.5, mat(0x5a5a5a, 0.5, { metalness: 0.5 }), 12), 0, 3.75, 0, { cast: true });
  add(g, box(5.6, 1.7, 0.3, mat(0x1a1a20, 0.6), 0.05), 0, 7.6, 0);
  const letters = 'MOTEL'.split('').map((ch, i) => { const m = new THREE.MeshBasicMaterial({ map: textTex((c, w, h) => { c.clearRect(0, 0, w, h); c.font = 'bold 200px Inter'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.fillText(ch, w / 2, 190); }, 256, 220), transparent: true, color: 0xff3a6a });
    const p = add(g, new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.86), m), -2.2 + i * 1.1, 7.6, 0.16); p.userData.camSkip = true; return m; });
  const bv = makeSign({ w: 3.4, h: 1.45, depth: 0.25, sub: 'ROOMS · COFFEE · WI-FI', glow: 0.95 }); bv.position.set(0, 5.55, -0.12); g.add(bv);
  const vac = new THREE.MeshBasicMaterial({ map: textTex((c, w, h) => { c.clearRect(0, 0, w, h); c.font = 'bold 96px Inter'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.fillText('VACANCY', w / 2, 100); }, 512, 120), transparent: true, color: 0x6af0ff });
  add(g, box(3.0, 0.6, 0.22, mat(0x1a1a20, 0.6), 0.04), 0, 4.2, 0);
  add(g, new THREE.Mesh(new THREE.PlaneGeometry(2.7, 0.52), vac), 0, 4.2, 0.12).userData.camSkip = true;
  const glow = glowSprite('rgba(255,70,120,0.7)', 6.5); glow.position.set(0, 7.7, 0.4); g.add(glow);
  const light = new THREE.PointLight(0xff4a7a, 18, 26, 1.4); light.position.set(0, 6.8, 1.2); g.add(light);
  const bvLight = new THREE.PointLight(0x7ad8ff, 6, 12, 1.6); bvLight.position.set(0, 5.4, 1.4); g.add(bvLight);
  return { g, letters, vac, glow, light, bv }; })();
ST.blockC(9.5, 10.5, 0.4, 'sign pole');
// lights: a sodium lamp over the lot, porch and office light, a dim blue night fill and moonlight
export const LAMP = new THREE.PointLight(0xffa850, 20, 28, 1.3); LAMP.position.set(-6.5, 6.0, 8.5); sc.add(LAMP);
add(sc, cyl(0.1, 0.12, 6.2, mat(0x5a5a5a, 0.5, { metalness: 0.4 }), 10), -6.5, 3.1, 7.6); add(sc, box(0.3, 0.12, 1.0, mat(0x3a3a3a)), -6.5, 6.15, 8.1);
add(sc, new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.6), new THREE.MeshBasicMaterial({ color: 0xffc070 })), -6.5, 6.08, 8.2); ST.blockC(-6.5, 7.6, 0.25, 'lamp pole');
const porch = new THREE.PointLight(0xffd8a0, 3, 14, 1.6); porch.position.set(1.0, 2.8, 1.6); sc.add(porch);
const officeL = new THREE.PointLight(0xffd8a0, 3, 10, 1.6); officeL.position.set(9.6, 2.2, 1.4); sc.add(officeL);
const hemi = new THREE.HemisphereLight(0x4a5a80, 0x1a1410, 0.55); sc.add(hemi);
const moon = new THREE.DirectionalLight(0x8aa0d0, 0.5); moon.position.set(-20, 30, 40); moon.target.position.set(0, 0, 6); moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048);
Object.assign(moon.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 120 }); sc.add(moon, moon.target);
// the night: the MOTEL letters buzz a little; room windows lit at random
export function night(t) {
  SIGN.letters.forEach((m, i) => { m.opacity = i === 2 && Math.sin(t * 23) > 0.96 ? 0.35 : 1; });
  for (const r of ROOMS) r.wm.color.set(r.lit ? 0xffc890 : 0x1a1a22);
}
export const F = {
  ana: ST.fig('ana', 0xffe2cc, { bun: true, s: 0.95 }, 1.05),
  ben: ST.fig('ben', 0xe8ecff, { s: 1.0 }, 1.0),
};
export function only(...names) { const keep = new Set(names); for (const [n, f] of Object.entries(ST.figs)) f.g.visible = keep.has(n); }
