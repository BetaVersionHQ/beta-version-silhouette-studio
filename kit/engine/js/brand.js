// Beta Version brand pieces for every film: the corner watermark (drawn into each frame by main.js), the card credits and
// the wall pieces (a framed poster, a lit sign or menu board, the phone lock screen). Everyday props that carry the mark
// like a retail brand (phone, mug, cups, laptop, bags, boxes, cans, TV, magnets, shirt prints) live in props.js. Images load from brand/*.png and fall
// back to the copies embedded in brand_data.js, so the brand is always there.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { WATERMARK, WORDMARK, MARK } from './brand_data.js';

const load = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
async function pick(file, data) { return (await load('brand/' + file)) || await load(data); }
export const IMG = {
  watermark: await pick('bv-watermark-256.png', WATERMARK),
  wordmark: await pick('bv-wordmark-transparent.png', WORDMARK),
  mark: await pick('bv-mark-transparent.png', MARK),
};
export const DATA = { WATERMARK, WORDMARK, MARK };
try { await document.fonts.load('600 40px Inter'); await document.fonts.load('400 40px Inter'); } catch (e) { /* fonts are optional for the textures */ }

export const PLATE = '#0d111c', CYAN = '#3be3ff';
export function tex(draw, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// the wordmark is light lettering: it always sits on a dark plate, scaled uniformly (never stretched or recoloured)
export function drawWordmark(x, cx, cy, maxW, maxH) {
  const im = IMG.wordmark, k = Math.min(maxW / im.width, maxH / im.height), w = im.width * k, h = im.height * k;
  x.drawImage(im, cx - w / 2, cy - h / 2, w, h);
}
export function roundRect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }

// plate texture: dark plate, the wordmark, an optional line of small text under it
export function plateTex({ w = 1024, h = 512, sub = '', bg = PLATE, border = true } = {}) {
  return tex((x, W, H) => {
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    if (border) { x.strokeStyle = 'rgba(59,227,255,.35)'; x.lineWidth = W * 0.008; roundRect(x, W * 0.03, H * 0.05, W * 0.94, H * 0.9, W * 0.02); x.stroke(); }
    drawWordmark(x, W / 2, sub ? H * 0.44 : H * 0.5, W * 0.84, sub ? H * 0.62 : H * 0.8);
    if (sub) { x.fillStyle = '#c9d2e6'; x.font = `600 ${Math.round(H * 0.075)}px Inter, sans-serif`; x.textAlign = 'center'; x.fillText(sub, W / 2, H * 0.86); }
  }, w, h);
}
export function markTex({ size = 256, bg = null } = {}) {
  return tex((x, W, H) => { if (bg) { x.fillStyle = bg; x.fillRect(0, 0, W, H); } x.drawImage(IMG.mark, W * 0.06, H * 0.06, W * 0.88, H * 0.88); }, size, size);
}

// every brand surface is tagged for the QA brand check: userData.brand (it shows the mark), brandN (the local direction it
// faces), and its prop group is the brandRoot (the prop's own body never counts as hiding its print)
export function tagBrand(m, n = [0, 0, 1]) { m.userData.brand = true; m.userData.brandN = n; return m; }
export const brandRoot = (g, name) => { g.userData.brandRoot = true; if (name) g.name = name; return g; };
const std = (c, r = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...extra });
const rbox = (w, h, d, m, r = 0.01) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 3, h / 3, d / 3)), m);

// a framed poster with real depth: moulded frame, a light mat, the dark print set back behind the frame lip.
// The group's back is at z = 0 and it faces +z: place it a few mm off the wall.
export function makePoster({ w = 1.1, h = 0.72, frame = 0x1c1a18, sub = 'SILHOUETTE STUDIO' } = {}) {
  const g = new THREE.Group(), fm = std(frame, 0.45), d = 0.05, b = 0.05;
  for (const [pw, ph, px, py] of [[w, b, 0, (h - b) / 2], [w, b, 0, -(h - b) / 2], [b, h - 2 * b, -(w - b) / 2, 0], [b, h - 2 * b, (w - b) / 2, 0]]) {
    const m = rbox(pw, ph, d, fm, 0.012); m.position.set(px, py, d / 2); m.castShadow = true; g.add(m);
  }
  const back = rbox(w - 0.02, h - 0.02, 0.012, std(0x2a2622, 0.9), 0.004); back.position.z = 0.006; g.add(back);
  const mat_ = new THREE.Mesh(new THREE.PlaneGeometry(w - 2 * b, h - 2 * b), std(0xe9e4da, 0.9)); mat_.position.z = 0.014; g.add(mat_);
  const pw = w - 2 * b - 0.08, ph = h - 2 * b - 0.08;
  const print = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({ map: plateTex({ w: 1024, h: Math.round(1024 * ph / pw), sub }), roughness: 0.55, emissive: 0xffffff, emissiveIntensity: 0.12, emissiveMap: null }));
  print.material.emissiveMap = print.material.map; print.position.z = 0.016; g.add(tagBrand(print));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - 2 * b, h - 2 * b), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.06, depthWrite: false }));
  glass.position.z = d - 0.008; glass.userData.camSkip = true; g.add(glass);
  return brandRoot(g, 'beta version poster');
}
// a lit sign box: frame with depth and a glowing face with the wordmark (shop sign, wall sign, menu board header).
// Faces +z, back at z = 0, centred on y. `lines` adds a list under the logo (a menu or price board).
export function makeSign({ w = 2.0, h = 0.7, depth = 0.12, sub = '', lines = null, glow = 0.85, frame = 0x14161c } = {}) {
  const g = new THREE.Group();
  const body = rbox(w, h, depth, std(frame, 0.5, { metalness: 0.3 }), 0.02); body.position.z = depth / 2; body.castShadow = true; g.add(body);
  const th = lines ? Math.round(1024 * h / w) : 400;
  const t = lines ? tex((x, W, H) => {
    x.fillStyle = PLATE; x.fillRect(0, 0, W, H); const top = H * 0.36;
    drawWordmark(x, W / 2, top * 0.55, W * 0.8, top * 0.85);
    x.strokeStyle = 'rgba(59,227,255,.5)'; x.lineWidth = 4; x.beginPath(); x.moveTo(W * 0.08, top); x.lineTo(W * 0.92, top); x.stroke();
    const n = lines.length, lh = (H - top) / (n + 0.6);
    x.font = `600 ${Math.round(lh * 0.5)}px Inter, sans-serif`;
    lines.forEach((l, i) => { const y = top + lh * (i + 0.95); const [a, b] = Array.isArray(l) ? l : [l, ''];
      x.fillStyle = '#e9edf5'; x.textAlign = 'left'; x.fillText(a, W * 0.1, y); x.fillStyle = CYAN; x.textAlign = 'right'; x.fillText(b, W * 0.9, y); });
  }, 1024, th) : plateTex({ w: 1024, h: Math.round(1024 * h / w), sub, border: true });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, h - 0.06), new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(glow, glow, glow) }));
  face.position.z = depth + 0.003; face.userData.camSkip = true; g.add(tagBrand(face)); g.face = face;
  return brandRoot(g, 'beta version sign');
}
// the phone lock screen: night gradient, the clock, the mark in the middle
export function phoneScreenTex(time = '9:41') {
  return tex((x, W, H) => {
    const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#16213a'); gr.addColorStop(1, '#070a12'); x.fillStyle = gr; x.fillRect(0, 0, W, H);
    x.fillStyle = '#eef1f7'; x.font = `600 ${Math.round(W * 0.2)}px Inter, sans-serif`; x.textAlign = 'center'; x.fillText(time, W / 2, H * 0.22);
    const s = W * 0.62; x.drawImage(IMG.mark, (W - s) / 2, H * 0.4, s, s);
  }, 128, 256);
}
