// The branded prop library: everyday objects that carry the Beta Version mark the way a retail brand does (the logo on
// the back of a phone, the print on a mug, the lid of a laptop). Every factory always prints the mark; there is no
// option to leave it off. Sets and films build these props from here instead of making their own, so whatever a
// character holds or uses is branded automatically.
//
// Rules the factories follow: finished shapes (bevels, 40+ segments on round parts), real depth, the mark small but
// readable, never stretched or recoloured. The mark and the wordmark are light artwork (cyan and white): they print
// straight onto dark surfaces, and onto a dark plate when the surface is light (a white mug, kraft card, paper).
// Every brand surface is tagged (userData.brand) for the QA brand check; each prop group is a brandRoot.
//
// Size: the figures have big mitten hands (13 cm across), so props people hold (phone, mug, cups, can, bottle) are built
// at HELD x real size by default; furniture-sized props (laptop, bag, boxes, TV) are real size. Pass scale to change it.
// Origins: props that stand (mug, cups, cans, bottle, bag, boxes, TV on its stand) have their base at y = 0 and the
// print facing +z. Wall pieces (magnet, wall TV) have their back at z = 0 and face +z. The phone is centred and its
// screen faces +z: use phone.lay(x, top, z, yaw, faceDown) to put it on a surface.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { IMG, PLATE, tex, drawWordmark, roundRect, plateTex, phoneScreenTex, tagBrand, brandRoot } from './brand.js';

export const HELD = 1.3;
const std = (c, r = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...extra });
const rbox = (w, h, d, m, r = 0.01, seg = 4) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2.2, h / 2.2, d / 2.2)), m);
const shadows = g => { g.traverse(o => { if (o.isMesh && !o.userData.brand) { o.castShadow = true; o.receiveShadow = true; } }); return g; };

// ---------- print textures ----------
// the mark alone (transparent around it) or on a rounded dark plate (for light surfaces)
export function badgeTex({ plate = false, size = 256, round = 0.24 } = {}) {
  return tex((x, W, H) => {
    if (plate) { x.fillStyle = PLATE; roundRect(x, 0, 0, W, H, W * round); x.fill(); }
    const s = plate ? 0.8 : 0.98; x.drawImage(IMG.mark, W * (1 - s) / 2, H * (1 - s) / 2, W * s, H * s);
  }, size, size);
}
// the wordmark alone (transparent) or on a dark plate; w/h is the print's aspect
export function wordTex({ plate = false, w = 1024, h = 436, sub = '' } = {}) {
  return tex((x, W, H) => {
    if (plate) { x.fillStyle = PLATE; roundRect(x, 0, 0, W, H, H * 0.12); x.fill(); }
    drawWordmark(x, W / 2, sub ? H * 0.42 : H / 2, W * 0.9, sub ? H * 0.62 : H * 0.9);
    if (sub) { x.fillStyle = '#c9d2e6'; x.font = `600 ${Math.round(H * 0.13)}px Inter, sans-serif`; x.textAlign = 'center'; x.fillText(sub, W / 2, H * 0.88); }
  }, w, h);
}
// a full wrap (cans, bottle labels): dark band, the mark or wordmark centred at the front (u = 0.5), a second mark at the back
function wrapTex({ word = false, aspect = 3.2, bg = PLATE, back = true } = {}) {
  const W = 1024, H = Math.round(W / aspect);
  return tex((x) => {
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(59,227,255,.45)'; x.lineWidth = H * 0.025; for (const y of [H * 0.08, H * 0.92]) { x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
    const put = cx => { if (word) drawWordmark(x, cx, H / 2, W * 0.3, H * 0.62); else { const s = H * 0.66; x.drawImage(IMG.mark, cx - s / 2, (H - s) / 2, s, s); } };
    put(W / 2); if (back) { put(0); put(W); }
  }, W, H);
}
// print material: a little self-light so the print reads in night scenes the way printed ink catches light
export function printMat(t, glow = 0.3, extra = {}) {
  return new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: glow, roughness: 0.45,
    transparent: true, alphaTest: 0.4, polygonOffset: true, polygonOffsetFactor: -2, ...extra });
}
// a flat print (decal) w x h, facing +z
export function decal(w, h, t, glow = 0.3) { return tagBrand(new THREE.Mesh(new THREE.PlaneGeometry(w, h), printMat(t, glow))); }
// a print that wraps part of a cylinder (centred on +z): radius at top/bottom, height, arc in radians
function wrapPrint(rt, rb, h, arc, t, glow = 0.3, seg = 40) {
  return tagBrand(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, true, -arc / 2, arc), printMat(t, glow)));
}
// a rounded rectangle plane with 0..1 UVs (screens)
function rrectGeo(w, h, r, seg = 10) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0); s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI); s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  const g = new THREE.ShapeGeometry(s, seg), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (p.getY(i) + h / 2) / h);
  return g;
}

// ---------- phone ----------
// A phone: the lock screen shows the mark when it glows; the back carries the mark centred like a phone maker's logo,
// with a camera island top-left. phone.setGlow(on); phone.lay(x, top, z, yaw, faceDown) rests it on a surface
// (faceDown shows the back logo). Held: act.js holdAt / phoneInHands / phoneAtEar.
export function makePhone({ body = 0x1d2027, time = '9:41', scale = HELD } = {}) {
  const g = new THREE.Group(), W = 0.074, H = 0.152, D = 0.0085; g.scale.setScalar(scale);
  g.add(new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 6, 0.004), std(body, 0.3, { metalness: 0.55 })));
  const scr = new THREE.Mesh(rrectGeo(W - 0.005, H - 0.005, 0.0085), new THREE.MeshBasicMaterial({ map: phoneScreenTex(time) }));
  scr.position.z = D / 2 + 0.0003; g.add(tagBrand(scr)); g.scr = scr;
  // camera island on the back, top-left as seen from behind (local +x)
  const isl = rbox(0.028, 0.028, 0.0022, std(0x14161b, 0.25, { metalness: 0.6 }), 0.006); isl.position.set(W / 2 - 0.0185, H / 2 - 0.0185, -D / 2 - 0.001); g.add(isl);
  const glass = std(0x050608, 0.08, { metalness: 0.8 }), ring = std(0x6a6e78, 0.3, { metalness: 0.9 });
  for (const [dx, dy] of [[0.0065, 0.0065], [-0.0065, -0.0065]]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.0058, 0.0058, 0.0018, 40), ring); r.rotation.x = Math.PI / 2; r.position.set(isl.position.x + dx, isl.position.y + dy, -D / 2 - 0.0028); g.add(r);
    const l = new THREE.Mesh(new THREE.CircleGeometry(0.0044, 40), glass); l.rotation.y = Math.PI; l.position.set(r.position.x, r.position.y, -D / 2 - 0.0038); g.add(l);
  }
  const logo = decal(0.019, 0.019, badgeTex(), 0.4); logo.rotation.y = Math.PI; logo.position.set(0, 0, -D / 2 - 0.0004); g.add(logo); g.logo = logo;
  g.setGlow = on => { scr.material.color.set(on ? 0xffffff : 0x0c0d11); scr.userData.brand = !!on; };
  g.setGlow(false);
  g.lay = (x, top, z, yaw = 0, faceDown = false) => { g.position.set(x, top + (D / 2 + (faceDown ? 0.0004 : 0.0038)) * scale, z); g.rotation.set(faceDown ? Math.PI / 2 : -Math.PI / 2, 0, faceDown ? -yaw : yaw); return g; };
  g.thick = D * scale;
  return brandRoot(shadows(g), 'phone');
}

// ---------- mug and cups ----------
// a ceramic mug, the mark printed on the side facing +z (always on a dark plate: a glossy dark glaze under bright lights reads pale and washed the mark out), handle on the -x side
export function makeMug({ color = 0xf2ebe2, coffee = true, scale = HELD } = {}) {
  const g = new THREE.Group(), m = std(color, 0.3); g.scale.setScalar(scale);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.046, 0.104, 56, 1, true), m); body.position.y = 0.058; g.add(body);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.043, 0.006, 56), m); foot.position.y = 0.003; g.add(foot);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.0465, 0.043, 0.1, 56, 1, true), std(color, 0.35, { side: THREE.BackSide })); inner.position.y = 0.06; g.add(inner);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.0483, 0.0019, 12, 64), m); lip.rotation.x = Math.PI / 2; lip.position.y = 0.11; g.add(lip);
  if (coffee) { const c = new THREE.Mesh(new THREE.CircleGeometry(0.0466, 48), std(0x2e1c10, 0.25)); c.rotation.x = -Math.PI / 2; c.position.y = 0.094; g.add(c); }
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.031, 0.0085, 16, 40, Math.PI), m); handle.position.set(-0.05, 0.06, 0); handle.rotation.z = Math.PI / 2; g.add(handle);
  // the print: a square patch (arc x radius = height) centred on +z
  const plate = true, ph = 0.05, rAt = y => 0.046 + 0.004 * (y - 0.006) / 0.104, r = rAt(0.06);
  const p = wrapPrint(rAt(0.085) + 0.0005, rAt(0.035) + 0.0005, ph, ph / r, badgeTex({ plate }), plate ? 0.22 : 0.35); p.position.y = 0.06; g.add(p);
  return brandRoot(shadows(g), 'mug');
}
export const makeBrandMug = (color = 0xf2ebe2) => makeMug({ color: typeof color === 'object' ? color.color : color });

// a takeaway coffee cup: paper cup, kraft sleeve with the mark on a dark badge, a domed lid with a sip slot
export function makeCoffeeCup({ cup = 0xf4f1ea, sleeve = 0xa7804f, lid = 0xf0eee8, scale = HELD } = {}) {
  const g = new THREE.Group(); g.scale.setScalar(scale); const h = 0.115, rt = 0.043, rb = 0.031, rAt = y => rb + (rt - rb) * y / h;
  const paper = std(cup, 0.7);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 56, 1, true), paper); body.position.y = h / 2; g.add(body);
  const base = new THREE.Mesh(new THREE.CircleGeometry(rb, 48), paper); base.rotation.x = Math.PI / 2; base.position.y = 0.002; g.add(base);
  const lm = std(lid, 0.45);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(rt + 0.0028, rt + 0.0022, 0.009, 56), lm); rim.position.y = h + 0.0035; g.add(rim);
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(rt - 0.007, rt + 0.0005, 0.01, 56), lm); dome.position.y = h + 0.0125; g.add(dome);
  const slot = rbox(0.016, 0.002, 0.005, std(0x2a2522, 0.6), 0.0009); slot.position.set(0, h + 0.0176, rt - 0.016); g.add(slot);
  const y0 = 0.03, y1 = 0.082, sm = std(sleeve, 0.85);
  const sl = new THREE.Mesh(new THREE.CylinderGeometry(rAt(y1) + 0.0014, rAt(y0) + 0.0014, y1 - y0, 56, 1, true), sm); sl.position.y = (y0 + y1) / 2; g.add(sl);
  const ph = 0.04, ym = (y0 + y1) / 2, r = rAt(ym) + 0.002;
  const p = wrapPrint(rAt(ym + ph / 2) + 0.002, rAt(ym - ph / 2) + 0.002, ph, ph / r, badgeTex({ plate: true }), 0.22); p.position.y = ym; g.add(p);
  return brandRoot(shadows(g), 'coffee cup');
}

// ---------- laptop ----------
// a dark aluminium laptop: the mark centred on the lid (faces away from the user), keyboard and trackpad on the base.
// laptop.setOpen(k) 0 closed .. 1 open (the screen lights as it opens; its wallpaper shows the mark)
export function makeLaptop({ scale = 1, color = 0x34373e } = {}) {
  const g = new THREE.Group(); g.scale.setScalar(scale);
  const alu = std(color, 0.32, { metalness: 0.5 });
  const base = rbox(0.36, 0.016, 0.24, alu, 0.006); base.position.y = 0.008; g.add(base);
  const keys = rbox(0.3, 0.0012, 0.11, std(0x121318, 0.6), 0.0005); keys.position.set(0, 0.0162, -0.02); g.add(keys);
  const pad = rbox(0.11, 0.0008, 0.07, std(color, 0.25, { metalness: 0.5 }), 0.0004); pad.position.set(0, 0.0162, 0.08); g.add(pad);
  // the lid hinges at the back edge (z -0.12); the user sits at +z
  const lid = new THREE.Group(); lid.position.set(0, 0.016, -0.12); g.add(lid);
  const back = rbox(0.36, 0.23, 0.009, alu, 0.006); back.position.y = 0.115; lid.add(back);
  const wall = tex((x, W, H) => { const gr = x.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#16213a'); gr.addColorStop(1, '#0a0d16'); x.fillStyle = gr; x.fillRect(0, 0, W, H); const s = H * 0.34; x.drawImage(IMG.mark, (W - s) / 2, (H - s) / 2, s, s); }, 512, 320);
  const scr = new THREE.Mesh(rrectGeo(0.33, 0.2, 0.004), new THREE.MeshBasicMaterial({ map: wall })); scr.position.set(0, 0.115, 0.0047); lid.add(tagBrand(scr));
  const logo = decal(0.042, 0.042, badgeTex(), 0.4); logo.rotation.y = Math.PI; logo.position.set(0, 0.118, -0.0047); lid.add(logo);
  g.lid = lid; g.scr = scr;
  g.setOpen = k => { lid.rotation.x = THREE.MathUtils.lerp(Math.PI / 2 - 0.04, -0.28, k); const on = Math.min(1, Math.max(0, (k - 0.5) * 2));
    scr.material.color.set(new THREE.Color(0x0c0d11).lerp(new THREE.Color(0xffffff), on)); scr.userData.brand = on > 0.5; };
  g.setOpen(1);
  return brandRoot(shadows(g), 'laptop');
}

// ---------- bags and boxes ----------
// a dark paper shopping bag with rope handles, the wordmark printed front and back
export function makeShoppingBag({ w = 0.32, h = 0.36, d = 0.14, color = 0x151b2b } = {}) {
  const g = new THREE.Group(), m = std(color, 0.8);
  const body = rbox(w, h, d, m, 0.004); body.position.y = h / 2; g.add(body);
  const hem = rbox(w + 0.003, 0.035, d + 0.003, std(new THREE.Color(color).multiplyScalar(0.8), 0.8), 0.002); hem.position.y = h - 0.0175; g.add(hem);
  const mouth = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.01, d - 0.01), std(0x05060a, 1)); mouth.rotation.x = -Math.PI / 2; mouth.position.y = h + 0.0006; g.add(mouth);
  const rope = std(0xd8d2c4, 0.9);
  for (const sz of [1, -1]) { const hd = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.0045, 10, 48, Math.PI), rope); hd.position.set(0, h - 0.012, sz * (d / 2 - 0.012)); g.add(hd); }
  const pw = w * 0.74, phh = pw / 2.35;
  for (const sz of [1, -1]) { const p = decal(pw, phh, wordTex({ h: 436 }), 0.3); p.position.set(0, h * 0.5, sz * (d / 2 + 0.0008)); if (sz < 0) p.rotation.y = Math.PI; g.add(p); }
  return brandRoot(shadows(g), 'shopping bag');
}
// a shipping box: kraft card, tape, the brand label on the front (+z)
export function makeBox({ w = 0.42, h = 0.3, d = 0.32 } = {}) {
  const g = new THREE.Group(), kraft = std(0xb08a5a, 0.95);
  const b = rbox(w, h, d, kraft, 0.008); b.position.y = h / 2; g.add(b);
  const tape = new THREE.Mesh(new THREE.PlaneGeometry(0.06, d + 0.004), std(0xc8b48a, 0.5)); tape.rotation.x = -Math.PI / 2; tape.position.set(0, h + 0.0008, 0); g.add(tape);
  const lw = Math.min(w * 0.8, h * 1.6), lh = lw * 0.45;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(lw, lh), new THREE.MeshStandardMaterial({ map: plateTex({ w: 512, h: 230, border: false }), roughness: 0.7, emissive: 0xffffff, emissiveIntensity: 0.12 }));
  label.material.emissiveMap = label.material.map; label.position.set(0, h * 0.52, d / 2 + 0.0015); g.add(tagBrand(label));
  return brandRoot(shadows(g), 'box');
}
export const makeBrandBox = (w = 0.42, h = 0.3, d = 0.32) => makeBox({ w, h, d });
// a cereal box: printed front (the wordmark, the product name, a bowl), navy sides
export function makeCerealBox({ w = 0.2, h = 0.29, d = 0.07, name = 'OAT CRUNCH' } = {}) {
  const g = new THREE.Group();
  const b = rbox(w, h, d, std(0x1b2747, 0.7), 0.003); b.position.y = h / 2; g.add(b);
  const front = tex((x, W, H) => {
    const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0d111c'); gr.addColorStop(1, '#1d3160'); x.fillStyle = gr; x.fillRect(0, 0, W, H);
    drawWordmark(x, W / 2, H * 0.12, W * 0.78, H * 0.13);
    x.fillStyle = '#f4f1ea'; x.textAlign = 'center'; x.font = `800 ${Math.round(W * 0.15)}px Inter, sans-serif`;
    const [a, b2] = name.split(' '); x.fillText(a || '', W / 2, H * 0.36); if (b2) x.fillText(b2, W / 2, H * 0.47);
    x.fillStyle = '#e8dcc4'; x.beginPath(); x.ellipse(W / 2, H * 0.72, W * 0.36, H * 0.1, 0, 0, 7); x.fill();
    x.fillStyle = '#d29a4a'; for (let i = 0; i < 14; i++) { x.beginPath(); x.arc(W * (0.24 + (i % 7) * 0.085), H * (0.67 + Math.floor(i / 7) * 0.04), W * 0.035, 0, 7); x.fill(); }
    x.fillStyle = '#3be3ff'; x.fillRect(W * 0.14, H * 0.74, W * 0.72, H * 0.08);
    x.fillStyle = '#c9d2e6'; x.font = `600 ${Math.round(W * 0.05)}px Inter, sans-serif`; x.fillText('WHOLE GRAIN · 375 g', W / 2, H * 0.93);
  }, 512, Math.round(512 * h / w));
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.004, h - 0.004), new THREE.MeshStandardMaterial({ map: front, roughness: 0.5, emissive: 0xffffff, emissiveMap: front, emissiveIntensity: 0.15 }));
  p.position.set(0, h / 2, d / 2 + 0.0008); g.add(tagBrand(p));
  return brandRoot(shadows(g), 'cereal box');
}

// ---------- drinks ----------
// a drink can: dark wrap with the mark front and back, aluminium ends
export function makeCan({ bg = PLATE, scale = HELD } = {}) {
  const g = new THREE.Group(); g.scale.setScalar(scale); const r = 0.033, h = 0.105, al = std(0xb8bcc4, 0.25, { metalness: 0.9 });
  const body = tagBrand(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 56, 1, true, -Math.PI, Math.PI * 2), new THREE.MeshStandardMaterial({ map: wrapTex({ aspect: (2 * Math.PI * r) / h, bg }), roughness: 0.35, metalness: 0.3 })));
  body.material.emissive = new THREE.Color(0xffffff); body.material.emissiveMap = body.material.map; body.material.emissiveIntensity = 0.15;
  body.position.y = 0.006 + h / 2; g.add(body);
  const bot = new THREE.Mesh(new THREE.CylinderGeometry(r, r - 0.006, 0.006, 56), al); bot.position.y = 0.003; g.add(bot);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.006, r, 0.01, 56), al); top.position.y = 0.006 + h + 0.005; g.add(top);
  const lid = new THREE.Mesh(new THREE.TorusGeometry(r - 0.0065, 0.0016, 10, 56), al); lid.rotation.x = Math.PI / 2; lid.position.y = 0.006 + h + 0.0105; g.add(lid);
  const tab = rbox(0.012, 0.0012, 0.02, al, 0.0005); tab.position.set(0, 0.006 + h + 0.0105, 0.006); g.add(tab);
  return brandRoot(shadows(g), 'can');
}
// a water bottle: clear plastic, water inside, a dark label band with the wordmark at the front
export function makeBottle({ scale = HELD } = {}) {
  const g = new THREE.Group(); g.scale.setScalar(scale);
  const prof = [[0, 0], [0.028, 0], [0.032, 0.005], [0.033, 0.02], [0.033, 0.15], [0.03, 0.172], [0.018, 0.198], [0.0145, 0.205], [0.0145, 0.215]].map(([x, y]) => new THREE.Vector2(x, y));
  const shell = new THREE.Mesh(new THREE.LatheGeometry(prof, 56), std(0xbfd8ee, 0.08, { transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide })); g.add(shell);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.14, 48), std(0x7fb4dc, 0.1, { transparent: true, opacity: 0.35, depthWrite: false })); water.position.y = 0.075; g.add(water);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0155, 0.0155, 0.016, 48), std(0x1b2747, 0.5)); cap.position.y = 0.222; g.add(cap);
  const lh = 0.06, label = tagBrand(new THREE.Mesh(new THREE.CylinderGeometry(0.0335, 0.0335, lh, 56, 1, true, -Math.PI, Math.PI * 2), new THREE.MeshStandardMaterial({ map: wrapTex({ word: true, aspect: (2 * Math.PI * 0.0335) / lh, back: false }), roughness: 0.5 })));
  label.material.emissive = new THREE.Color(0xffffff); label.material.emissiveMap = label.material.map; label.material.emissiveIntensity = 0.15;
  label.position.y = 0.09; g.add(label);
  return brandRoot(shadows(g), 'bottle');
}

// ---------- screens ----------
// a TV or monitor: thin bezel, the mark as a small badge on the bottom bezel, a boot screen with the wordmark.
// stand: true stands on its foot (base at y = 0); false hangs on a wall (back at z = 0, centred). tv.setOn(k).
export function makeTV({ w = 1.1, stand = true } = {}) {
  const g = new THREE.Group(), h = w * 9 / 16, chin = 0.016, D = 0.04, frame = std(0x0e0f12, 0.35, { metalness: 0.4 });
  const set = new THREE.Group(); g.add(set);
  const body = rbox(w + 0.03, h + 0.03 + chin, D, frame, 0.01); body.position.set(0, -chin / 2, 0); set.add(body);
  const boot = tex((x, W, H) => { x.fillStyle = '#05070c'; x.fillRect(0, 0, W, H); drawWordmark(x, W / 2, H / 2, W * 0.34, H * 0.3); }, 1024, 576);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: boot })); scr.position.z = D / 2 + 0.0006; set.add(tagBrand(scr));
  const badge = decal(0.022, 0.022, badgeTex(), 0.45); badge.position.set(0, -h / 2 - 0.0155, D / 2 + 0.0008); set.add(badge);
  if (stand) {
    set.position.y = 0.2 + h / 2 + chin + 0.015;
    const neck = rbox(0.07, 0.24, 0.03, frame, 0.008); neck.position.set(0, 0.13, -0.03); g.add(neck);
    const foot = rbox(Math.min(0.42, w * 0.38), 0.014, 0.22, frame, 0.006); foot.position.set(0, 0.007, -0.02); g.add(foot);
  } else set.position.z = D / 2;
  g.setOn = k => { scr.material.color.set(new THREE.Color(0x07080b).lerp(new THREE.Color(0xffffff), k)); scr.userData.brand = k > 0.5; };
  g.setOn(1); g.screen = scr;
  return brandRoot(shadows(g), 'tv');
}

// ---------- small pieces ----------
// a fridge magnet: dark rounded tile with the mark; back at z = 0, faces +z
export function makeMagnet({ size = 0.06 } = {}) {
  const g = new THREE.Group();
  const t = rbox(size, size, 0.007, std(0x0d111c, 0.4), 0.0025); t.position.z = 0.0035; g.add(t);
  const p = decal(size * 0.84, size * 0.84, badgeTex(), 0.4); p.position.z = 0.0072; g.add(p);
  return brandRoot(shadows(g), 'magnet');
}
// a small mark printed on a figure's shirt or hoodie (chest or back). Figures are dark, so the mark prints without a plate.
// Use it for a character who wears the brand (a crew shirt, a hoodie); it follows the body.
export function printOnFigure(f, { where = 'chest', size = 0.13 } = {}) {
  const R = 0.2735, arc = size / (R * 1.08), back = where === 'back';   // the torso is scaled 1.08 wide: the arc is narrowed so the mark keeps its shape
  const m = tagBrand(new THREE.Mesh(new THREE.CylinderGeometry(R, R, size, 40, 1, true, (back ? Math.PI : 0) - arc / 2, arc), printMat(badgeTex(), 0.3)), back ? [0, 0, -1] : [0, 0, 1]);
  m.position.y = back ? 0.14 : 0.1; f.torso.add(m); f.g.userData.brandRoot = true; f.print = m;
  return m;
}
