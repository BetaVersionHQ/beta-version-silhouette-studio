// Beta Version Silhouette Studio engine: shared rig, IK, poses, props, frame format and helpers.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export { THREE, RoundedBoxGeometry };
export { IMG as BRAND_IMG, makePoster, makeSign, plateTex, markTex, phoneScreenTex, tagBrand, brandRoot } from './brand.js';
export { makePhone, makeMug, makeBrandMug, makeCoffeeCup, makeLaptop, makeShoppingBag, makeBox, makeBrandBox, makeCerealBox, makeCan, makeBottle, makeTV, makeMagnet, printOnFigure, decal, badgeTex, wordTex, printMat } from './props.js';

// Frame format comes from the film's film.json: "format": "long" (16:9, 1280x720) or "short" (9:16, 720x1280). 30 fps.
export const FILM = await (await fetch('film.json')).json();
export const FORMAT = FILM.format === 'short' ? 'short' : 'long';
export const W = FORMAT === 'short' ? 720 : 1280, H = FORMAT === 'short' ? 1280 : 720, FPS = 30;
export const ASPECT = W / H, PORTRAIT = H > W;
// the corner watermark box in normalised screen coordinates [x0, x1, y0, y1] (y down); cameras and captions keep clear of it
export const WM = (() => { const w = (PORTRAIT ? 0.12 : 0.1) * W, m = 0.025 * W; return [(W - m - w) / W, (W - m) / W, m / H, (m + w) / H]; })();
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const win = (t, a, b, fa = 0.3, fb = 0.3) => smooth(a, a + fa, t) * (1 - smooth(b, b + fb, t));
export const easeOutBack = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
export const $ = id => document.getElementById(id);
export const mat = (c, r = 0.85, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...extra });
export const basic = c => new THREE.MeshBasicMaterial({ color: c });
export function textTex(draw, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.redraw = d => { d(c.getContext('2d'), w, h); t.needsUpdate = true; };
  return t;
}
// every box gets a small bevel so edges catch light like real finished objects (r < 0 forces a sharp box)
export function box(w, h, d, m, r = 0) {
  if (r === 0) r = Math.min(0.018, Math.min(w, h, d) * 0.22);
  return new THREE.Mesh(r > 0.002 ? new RoundedBoxGeometry(w, h, d, 4, r) : new THREE.BoxGeometry(w, h, d), m);
}
export function cyl(rt, rb, h, m, seg = 40) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, Math.max(seg, 20)), m); }
export function add(parent, mesh, x, y, z, opts = {}) {
  mesh.position.set(x, y, z);
  if (opts.ry) mesh.rotation.y = opts.ry; if (opts.rx) mesh.rotation.x = opts.rx; if (opts.rz) mesh.rotation.z = opts.rz;
  if (opts.shadow !== false) { mesh.castShadow = !!opts.cast; mesh.receiveShadow = opts.receive !== false; }
  parent.add(mesh); return mesh;
}

// ---------- timeline ----------
export const TL = await (await fetch('timeline.json')).json();
export const ENV = await (await fetch('env.json').then(r => r.ok ? r : null).catch(() => null))?.json?.() || {};
export const SC = Object.fromEntries(TL.scenes.map(s => [s.name, s]));
export const mk = (scene, name) => { const v = TL.marks[`${scene}.${name}`]; if (v === undefined) throw new Error('mark ' + scene + '.' + name); return v; };
export const linesOf = scene => TL.lines.filter(l => l.scene === scene);
export const env = (who, t) => { const a = ENV[who]; if (!a) return 0; return a[clamp(Math.floor(t * FPS), 0, a.length - 1)] || 0; };
export const lineEnd = l => l.start + l.dur;
export const talkW = (l, t, pre = 0.15, post = 0.4) => win(t, l.start - pre, lineEnd(l) + 0.05, 0.25, post);

// ---------- silhouette material ----------
export function rimMaterial({ rim = 0xffe6cc, power = 5.5, strength = 1.0, base = 0x060506, light = 0xffc488, lightStr = 0.18, fall = 0 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uRim: { value: new THREE.Color(rim) }, uPow: { value: power }, uStr: { value: strength }, uBase: { value: new THREE.Color(base) },
      uLightPos: { value: V(0, 2.6, 0) }, uLightCol: { value: new THREE.Color(light) }, uLightStr: { value: lightStr }, uFall: { value: fall },
    },
    vertexShader: `
      varying vec3 vN; varying vec3 vP;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vP = wp.xyz; vN = normalize(transpose(inverse(mat3(modelMatrix))) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform vec3 uRim, uBase, uLightPos, uLightCol; uniform float uPow, uStr, uLightStr, uFall;
      varying vec3 vN; varying vec3 vP;
      void main() {
        vec3 n = normalize(vN); vec3 v = normalize(cameraPosition - vP);
        float f = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), uPow);
        vec3 L = uLightPos - vP; float d = length(L); L /= d;
        float k = pow(max(dot(n, L), 0.0), 3.0) * (uFall > 0.0 ? smoothstep(uFall, 0.2, d) : 1.0);
        gl_FragColor = vec4(uBase + uRim * f * uStr + uLightCol * k * uLightStr, 1.0);
      }`,
  });
}

// ---------- figure ----------
export const A_LEN = 0.36 + 0.065, B_LEN = 0.32 + 0.06 * 1.2;
const DOWN = V(0, -1, 0);
function capsule(r, len, m) { const c = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 12, 32), m); c.position.y = -(len / 2 + r * 0.6); return c; }
export function makeFigure(m, { bun = false, ponytail = false, tall = false, s = 1, eye = 1 } = {}) {
  const g = new THREE.Group(); g.scale.setScalar(s);
  const body = new THREE.Group(); g.add(body);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.55, 16, 48), m);
  torso.scale.set(1.08, 1, 0.78); torso.position.y = 1.27; body.add(torso);
  const headPivot = new THREE.Group(); headPivot.position.y = 1.72; body.add(headPivot);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 72, 54), m); head.position.y = 0.36; headPivot.add(head);
  if (bun) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.15, 40, 30), m); b.position.set(0, 0.72, -0.12); headPivot.add(b); }
  if (ponytail) {
    const tie = new THREE.Mesh(new THREE.SphereGeometry(0.08, 28, 20), m); tie.position.set(0, 0.55, -0.33); headPivot.add(tie);
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.32, 10, 24), m); tail.position.set(0, 0.36, -0.42); tail.rotation.x = 0.35; headPivot.add(tail);
  }
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(eye) }), eyes = [];
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.036, 24, 16), eyeMat); e.position.set(sx * 0.11, 0.35, 0.325); headPivot.add(e); eyes.push(e); }
  const limb = (x, y, r1, l1, r2, l2) => {
    const top = new THREE.Group(); top.position.set(x, y, 0); top.add(capsule(r1, l1, m));
    const joint = new THREE.Group(); joint.position.y = -(l1 + r1); top.add(joint); joint.add(capsule(r2, l2, m));
    body.add(top); return { top, joint };
  };
  const legL = limb(-0.13, 0.86, 0.085, 0.36, 0.075, 0.40), legR = limb(0.13, 0.86, 0.085, 0.36, 0.075, 0.40);
  for (const l of [legL, legR]) {
    const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.1, 10, 24), m);
    foot.rotation.x = Math.PI / 2; foot.position.set(0, -(0.40 + 0.075 * 1.3), 0.06); l.joint.add(foot); l.foot = foot;
  }
  const f = { g, body, headPivot, head, torso, eyes, eyeMat, eyeBase: eye, legL, legR, s, mat: m,
    armL: limb(-0.31, 1.6, 0.065, 0.36, 0.06, 0.32), armR: limb(0.31, 1.6, 0.065, 0.36, 0.06, 0.32) };
  // mitten hands: a slightly flattened rounded mass at the wrist so arms don't end in bare tubes
  for (const arm of [f.armL, f.armR]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.066, 32, 24), m);
    hand.scale.set(0.82, 1.12, 1.0); hand.position.y = -(B_LEN - 0.015); arm.joint.add(hand); arm.hand = hand;
  }
  // shoulder caps fill the gap between the torso and the upper arm when arms swing out
  for (const sx of [-1, 1]) { const sh = new THREE.Mesh(new THREE.SphereGeometry(0.085, 32, 24), m); sh.position.set(sx * 0.29, 1.585, 0); body.add(sh); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return f;
}
export function ik(arm, T, pole) {
  const S = arm.top.position.clone(), D = T.clone().sub(S);
  const d = clamp(D.length(), 0.12, A_LEN + B_LEN - 0.005); D.normalize();
  const cosA = clamp((A_LEN * A_LEN + d * d - B_LEN * B_LEN) / (2 * A_LEN * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
  const pn = pole.clone().normalize();
  const perp = pn.sub(D.clone().multiplyScalar(pn.dot(D))).normalize();
  const E = S.clone().addScaledVector(D, cosA * A_LEN).addScaledVector(perp, sinA * A_LEN);
  const Tc = S.clone().addScaledVector(D, d);
  arm.top.quaternion.setFromUnitVectors(DOWN, E.clone().sub(S).normalize());
  arm.joint.quaternion.setFromUnitVectors(DOWN, Tc.sub(E).normalize().applyQuaternion(arm.top.quaternion.clone().invert()));
}
// arm IK toward a WORLD target (pole given in body space)
export function ikWorld(f, side, worldT, pole) {
  f.g.updateMatrixWorld(true);
  ik(side === 'L' ? f.armL : f.armR, f.body.worldToLocal(worldT.clone()), pole);
}
export const handWorld = arm => arm.joint.localToWorld(V(0, -B_LEN, 0));
export function blink(f, t, seed, open = 1) {
  const c = ((t + seed) % 3.7) < 0.12 ? 0.15 : 1;
  if (f.face) return f.face(open, c);   // looks.js: white eyes and brows, shadow-self red eyes
  for (const e of f.eyes) e.scale.set(1, c * open + (1 - open) * 0.1, 0.5);
  f.eyeMat.color.setScalar(lerp(0.12, f.eyeBase ?? 1, clamp(open * 1.5)));
}

// ---------- whole-body pose in hip space ----------
// pose: { hip: V (world), quat: Quaternion (figure frame), tilt (torso pitch about hips), thigh, knee (per leg arrays or numbers), head: [x,y,z] }
export const STAND_HIP = 0.86 + 0.1375; // hip height (unscaled) with straight legs and feet on the floor
export function yawQ(yaw) { return new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw); }
export function basisQ(xAxis, yAxis, zAxis) { return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis)); }
export function applyPose(f, p) {
  const s = f.s;
  f.g.quaternion.copy(p.quat);
  f.body.rotation.set(p.tilt || 0, 0, p.roll || 0);
  const tl = p.tilt || 0;
  f.body.position.set(0, 0.86 * (1 - Math.cos(tl)), -0.86 * Math.sin(tl));
  const hipLocal = V(0, 0.86, 0).multiplyScalar(s).applyQuaternion(p.quat);
  f.g.position.copy(p.hip).sub(hipLocal);
  const th = Array.isArray(p.thigh) ? p.thigh : [p.thigh || 0, p.thigh || 0], kn = Array.isArray(p.knee) ? p.knee : [p.knee || 0, p.knee || 0];
  const sp = p.spread || 0;
  f.legL.top.rotation.set(th[0] - tl, 0, -sp); f.legL.joint.rotation.set(kn[0], 0, 0);
  f.legR.top.rotation.set(th[1] - tl, 0, sp); f.legR.joint.rotation.set(kn[1], 0, 0);
  const hd = p.head || [0, 0, 0]; f.headPivot.rotation.set(hd[0], hd[1], hd[2]);
  f.g.updateMatrixWorld(true);
}
export function blendPose(a, b, k) {
  const ar = (x, y) => (Array.isArray(x) || Array.isArray(y)) ? [0, 1].map(i => lerp(Array.isArray(x) ? x[i] : (x || 0), Array.isArray(y) ? y[i] : (y || 0), k)) : lerp(x || 0, y || 0, k);
  return {
    hip: a.hip.clone().lerp(b.hip, k), quat: a.quat.clone().slerp(b.quat, k), tilt: lerp(a.tilt || 0, b.tilt || 0, k), roll: lerp(a.roll || 0, b.roll || 0, k),
    thigh: ar(a.thigh, b.thigh), knee: ar(a.knee, b.knee), spread: lerp(a.spread || 0, b.spread || 0, k),
    head: [0, 1, 2].map(i => lerp((a.head || [0, 0, 0])[i], (b.head || [0, 0, 0])[i], k)),
    seated: !!(a.seated && b.seated), inBed: !!(a.inBed || b.inBed), // between two bed/seat poses the body stays on the furniture
  };
}
// seated on a seat of height `top` (world), feet down, facing yaw; hips at (x,z)
export function seatPose(f, x, z, top, yaw, tilt = 0.08, head = [0.05, 0, 0]) {
  return { hip: V(x, top + 0.085 * f.s, z), quat: yawQ(yaw), tilt, thigh: -Math.PI / 2 + 0.03, knee: Math.PI / 2 - 0.03, head };
}
export function standPose(f, x, z, yaw, head = [0.05, 0, 0]) { return { hip: V(x, STAND_HIP * f.s, z), quat: yawQ(yaw), tilt: 0.02, thigh: 0, knee: 0, head }; }
// walking along a path of [x,z] points, param u in [0,1], stride phase from distance travelled
export function walkPose(f, pts, u, opts = {}) {
  const seg = []; let total = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); total += d; }
  let dist = clamp(u) * total, i = 0; while (i < seg.length - 1 && dist > seg[i]) { dist -= seg[i]; i++; }
  const k = seg[i] ? dist / seg[i] : 0, a = pts[i], b = pts[i + 1] || pts[i];
  const x = lerp(a[0], b[0], k), z = lerp(a[1], b[1], k);
  const yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
  const travelled = clamp(u) * total, stride = 0.62 * f.s;
  // steps shorten over the first and last 0.3 m; the phase runs faster there so a planted foot still never skates
  const r = Math.min(0.3, total / 2), a0 = 0.3, Fu = x => r / (1 - a0) * Math.log((a0 + (1 - a0) * clamp(x / r)) / a0) + Math.max(0, x - r);
  const rampAmp = d => a0 + (1 - a0) * clamp(Math.min(d, total - d) / r);
  const eff = travelled <= total / 2 ? Fu(travelled) : 2 * Fu(total / 2) - Fu(total - travelled);
  const p = (opts.amp === undefined ? eff : travelled) / stride * Math.PI;
  const amp = opts.amp ?? rampAmp(travelled);
  // stance: the planted foot moves back at exactly the hip's speed (no skating); swing: it comes forward on an ease
  const Leff = 0.86 * f.s, half = stride / 2 * amp;
  // the stance foot is placed from where it touched down and stays exactly there while the hip travels on (also while the
  // steps lengthen or shorten over the first and last 0.3 m); the swing carries it from where it lifted to the next landing
  const Finv = e => { const er = Fu(r); return e <= er ? r / (1 - a0) * (a0 * Math.exp(e * (1 - a0) / r) - a0) : r + (e - er); };
  const effMid = 2 * Fu(total / 2), travAt = e => opts.amp !== undefined ? e : (e = clamp(e, 0, effMid), e <= effMid / 2 ? Finv(e) : total - Finv(effMid - e));
  const halfAt = e => stride / 2 * (opts.amp ?? rampAmp(travAt(Math.max(0, e))));
  const leg = ph => { let q = ((p + ph + Math.PI / 2) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI / 2, x;
    const E = ph => ph * stride / Math.PI;
    if (q < Math.PI / 2) { const e0 = E(p - (q + Math.PI / 2)); x = -halfAt(e0) + (travAt(Math.max(0, E(p))) - travAt(Math.max(0, e0))); }
    else { const e0 = E(p - (q + Math.PI / 2)), e1 = E(p - (q - Math.PI / 2)), en = E(p + (3 * Math.PI / 2 - q));
      const xEnd = -halfAt(e0) + (travAt(Math.max(0, e1)) - travAt(Math.max(0, e0))); x = lerp(xEnd, -halfAt(en), (1 - Math.cos(q - Math.PI / 2)) / 2); }
    return Math.asin(clamp(x / Leff, -0.9, 0.9)); };
  const knee = ph => Math.max(0, -Math.cos(p + ph)) * 0.75 * amp;
  return { pose: { hip: V(x, STAND_HIP * f.s + Math.abs(Math.sin(p)) * 0.03 * amp, z), quat: yawQ(opts.yaw ?? yaw), tilt: 0.04, thigh: [leg(0), leg(Math.PI)], knee: [knee(0), knee(Math.PI)], head: opts.head || [0.08, 0, 0], roll: Math.sin(p) * 0.02 * amp }, phase: p, yaw, x, z, total,
    // per leg: -1 while it is the stance leg, else how far through its swing (0..1)
    stance: [0, Math.PI].map(ph => { const q = ((p + ph + Math.PI / 2) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI / 2; return q < Math.PI / 2 ? -1 : (q - Math.PI / 2) / Math.PI; }) };
}
// after applyPose: drop/raise the whole figure so the lowest foot touches the floor (y=floor)
// floor: a height, or a function (x, z) -> height, so on stairs each foot is measured against the tread under it and the
// figure rests on whichever foot meets its own tread first
export function plantFeet(f, floor = 0) {
  f.g.updateMatrixWorld(true);
  const fy = Math.min(...[f.legL, f.legR].map(l => { const q = l.foot.localToWorld(V(0, 0, 0)); return q.y - (typeof floor === 'function' ? floor(q.x, q.z) : floor); })) - 0.055 * f.s;
  f.g.position.y -= fy; f.g.updateMatrixWorld(true);
}
// two-bone leg IK in the leg's own (sagittal) plane: foot origin to a WORLD target, knee bending forward
const LEG_A = 0.36 + 0.085, LEG_B = Math.hypot(0.40 + 0.075 * 1.3, 0.06), LEG_BETA = Math.atan2(0.06, 0.40 + 0.075 * 1.3);
export function ikLeg(l, worldT) {
  const b = l.top.parent; b.updateMatrixWorld(true);
  const q = b.worldToLocal(worldT.clone()).sub(l.top.position), ty = q.y, tz = q.z;
  const d = clamp(Math.hypot(ty, tz), 0.2, LEG_A + LEG_B - 0.002), phi = Math.atan2(-tz, -ty);
  const al = Math.acos(clamp((LEG_A * LEG_A + d * d - LEG_B * LEG_B) / (2 * LEG_A * d), -1, 1)), th = phi - al;
  const ky = -LEG_A * Math.cos(th), kz = -LEG_A * Math.sin(th), ey = -d * Math.cos(phi), ez = -d * Math.sin(phi);
  const psi = Math.atan2(-(ez - kz), -(ey - ky));
  l.top.rotation.x = th; l.joint.rotation.x = psi - th + LEG_BETA;
}
// raise (never lower) the figure so no foot sinks below the floor
export function liftFeet(f, floor = 0) {
  f.g.updateMatrixWorld(true);
  const fy = Math.min(...[f.legL, f.legR].map(l => l.foot.localToWorld(V(0, 0, 0)).y)) - 0.055 * f.s;
  if (fy < floor) { f.g.position.y += floor - fy; f.g.updateMatrixWorld(true); }
}
// lying in bed on the right side, facing +z, head toward -x
export function lieSidePose(f, headX, bedTop, z, { knees = 0.9, breath = 0 } = {}) {
  const q = basisQ(V(0, 1, 0), V(-1, 0, 0), V(0, 0, 1));
  const hipX = headX + (2.08 - 0.86) * f.s;
  return { hip: V(hipX, bedTop + 0.27 * f.s + breath, z), quat: q, tilt: 0, thigh: [-knees, -knees * 0.8], knee: [knees * 1.35, knees * 1.2], head: [0.05, 0, -0.42] , seated: true, inBed: true };
}
// lying on the back, face up, head toward -x
export function lieBackPose(f, headX, bedTop, z, { breath = 0 } = {}) {
  const q = basisQ(V(0, 0, -1), V(-1, 0, 0), V(0, 1, 0));
  const hipX = headX + (2.08 - 0.86) * f.s;
  return { hip: V(hipX, bedTop + 0.21 * f.s + breath, z), quat: q, tilt: 0, thigh: [0.03, 0.05], knee: [0.1, 0.06], head: [0.38, 0, 0] , seated: true, inBed: true };
}
// sitting up in bed against the headboard, legs straight toward +x under the blanket
export function sitUpPose(f, hipX, bedTop, z, recline = 0.32, head = [0.3, 0, 0]) {
  return { hip: V(hipX, bedTop + 0.085 * f.s, z), quat: yawQ(Math.PI / 2), tilt: -recline, thigh: -Math.PI / 2 + 0.06, knee: 0.08, head , seated: true, inBed: true };
}

// ---------- props ----------
// branded everyday props (phone, mug, cups, laptop, bags, boxes, drinks, TV, magnet, shirt print) come from props.js
// soft steam puffs above a mug
export function makeSteam() {
  const tex = textTex((x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }, 64, 64);
  const grp = new THREE.Group(), puffs = [];
  for (let i = 0; i < 6; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 })); grp.add(sp); puffs.push(sp); }
  grp.update = (t, strength = 1) => puffs.forEach((p, i) => {
    const ph = ((t * 0.45 + i / puffs.length) % 1);
    p.position.set(Math.sin(t * 1.3 + i * 2) * 0.02 * (1 + ph * 2), 0.12 + ph * 0.28, Math.cos(t * 1.1 + i) * 0.015);
    const sc = 0.05 + ph * 0.12; p.scale.set(sc, sc, sc); p.material.opacity = Math.sin(ph * Math.PI) * 0.35 * strength;
  });
  return grp;
}
// candle with flickering flame + light
export function makeCandle(h = 0.16) {
  const g = new THREE.Group();
  const wax = cyl(0.025, 0.025, h, mat(0xf3eadb, 0.6), 16); wax.position.y = h / 2; g.add(wax);
  const holder = cyl(0.045, 0.05, 0.02, mat(0xb08a50, 0.3), 20); holder.position.y = 0.01; g.add(holder);
  const flameTex = textTex((x, w, hh) => { const gr = x.createRadialGradient(w / 2, hh * 0.62, 0, w / 2, hh * 0.62, w / 2); gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(0.35, 'rgba(255,190,90,.9)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); x.fillStyle = gr; x.beginPath(); x.ellipse(w / 2, hh * 0.6, w * 0.32, hh * 0.45, 0, 0, 7); x.fill(); }, 64, 128);
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, transparent: true, depthWrite: false })); flame.scale.set(0.035, 0.07, 1); flame.position.y = h + 0.03; g.add(flame);
  const light = new THREE.PointLight(0xffb060, 0.6, 2.2, 1.6); light.position.y = h + 0.05; g.add(light);
  const smokeTex = textTex((x, w, hh) => { const gr = x.createRadialGradient(w / 2, hh / 2, 0, w / 2, hh / 2, w / 2); gr.addColorStop(0, 'rgba(200,200,210,.5)'); gr.addColorStop(1, 'rgba(200,200,210,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, hh); }, 64, 64);
  const smoke = []; for (let i = 0; i < 5; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 })); g.add(s); smoke.push(s); }
  g.update = (t, lit, outT = null) => {
    const hh = h * (g.hk ?? 1); wax.scale.y = g.hk ?? 1; wax.position.y = hh / 2; flame.position.y = hh + 0.03; light.position.y = hh + 0.05;
    flame.visible = lit > 0.01; const fl = 1 + Math.sin(t * 23) * 0.06 + Math.sin(t * 37 + 1) * 0.04;
    flame.scale.set(0.035 * lit, 0.07 * lit * fl, 1); flame.material.opacity = lit; light.intensity = 0.6 * lit * fl;
    smoke.forEach((s, i) => {
      const u = outT === null ? -1 : (t - outT - i * 0.25) / 2.2;
      if (u < 0 || u > 1) { s.material.opacity = 0; return; }
      s.position.set(Math.sin(u * 6 + i) * 0.03, hh + 0.04 + u * 0.4, 0); const sc = 0.03 + u * 0.12; s.scale.set(sc, sc, sc); s.material.opacity = Math.sin(u * Math.PI) * 0.4;
    });
  };
  g.light = light;
  return g;
}

// ---------- blanket draped over bodies (heightfield) ----------
// covers x from coverX(z) to x1, z from z0 to z1 (plus overhang hanging down at front z1 and foot x1)
export function makeBlanket({ x1, z0, z1, top, coverX, color = 0x2a3247, nx = 64, nz = 44, hang = 0.4, floor = 0.12 }) {
  const geo = new THREE.PlaneGeometry(1, 1, nx, nz); geo.rotateX(-Math.PI / 2);
  const m = mat(color, 0.95, { side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = "blanket";
  const pos = geo.attributes.position, N = (nx + 1) * (nz + 1), hgt = new Float32Array(N), tmp = new Float32Array(N), raw = new Float32Array(N);
  const zAt = j => lerp(z0, z1 + hang, j / nz);
  mesh.update = (caps) => {
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const idx = j * (nx + 1) + i, z = zAt(j), cx = coverX(Math.min(z, z1));
      const x = lerp(cx, x1 + hang, i / nx);
      let h = top + 0.03;
      for (const c of caps) {
        const ax = c.a.x, az = c.a.z, bx = c.b.x, bz = c.b.z, dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
        const u = L2 > 1e-6 ? clamp(((x - ax) * dx + (z - az) * dz) / L2) : 0;
        const px = ax + u * dx, pz = az + u * dz, d = Math.hypot(x - px, z - pz), R = c.r + 0.05;
        if (d < R) h = Math.max(h, lerp(c.a.y, c.b.y, u) + Math.sqrt(R * R - d * d));
      }
      hgt[idx] = h; pos.setXYZ(idx, x, h, z);
    }
    // soft drape: blur, but never sink below the bodies (max with the raw field)
    raw.set(hgt);
    for (let pass = 0; pass < (mesh.passes || 9); pass++) {
      for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
        let s = 0, c = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const jj = j + dj, ii = i + di; if (jj < 0 || jj > nz || ii < 0 || ii > nx) continue; s += hgt[jj * (nx + 1) + ii]; c++; }
        tmp[j * (nx + 1) + i] = Math.max(s / c, raw[j * (nx + 1) + i] - 0.02);
      }
      hgt.set(tmp);
    }
    // hang over the front edge and the foot of the bed
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const idx = j * (nx + 1) + i, z = zAt(j), x = pos.getX(idx);
      const over = Math.max(z - z1, x - x1);
      let h = hgt[idx];
      if (over > 0) { const k = clamp(over / hang); h = lerp(top + 0.03, floor, Math.sin(k * Math.PI / 2)); pos.setXYZ(idx, Math.min(x, x1 + 0.06 + k * 0.03), h, Math.min(z, z1 + 0.06 + k * 0.03)); continue; }
      pos.setY(idx, h);
    }
    pos.needsUpdate = true; geo.computeVertexNormals();
    const pts = []; for (let j = 0; j <= nz; j += 2) { const idx = j * (nx + 1); pts.push(V(pos.getX(idx), pos.getY(idx) - 0.01, pos.getZ(idx))); }
    if (hem.geometry) hem.geometry.dispose();
    hem.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.035, 8, false);
  };
  const hem = new THREE.Mesh(new THREE.BufferGeometry(), mat(new THREE.Color(color).multiplyScalar(1.15).getHex(), 0.95)); hem.castShadow = true; hem.name = "blanket";
  mesh.add(hem);
  return mesh;
}
// world-space capsules approximating a figure's body (torso, thighs, shins) for the blanket
export function bodyCaps(f, breath = 0) {
  f.g.updateMatrixWorld(true);
  const caps = [], s = f.s;
  const tA = f.torso.localToWorld(V(0, -0.3, 0)), tB = f.torso.localToWorld(V(0, 0.3, 0));
  caps.push({ a: tA, b: tB, r: 0.27 * s * 1.05 + breath });
  for (const l of [f.legL, f.legR]) {
    const h = l.top.localToWorld(V(0, 0, 0)), k = l.joint.localToWorld(V(0, 0, 0)), a = l.foot.localToWorld(V(0, 0, 0));
    caps.push({ a: h, b: k, r: 0.09 * s }); caps.push({ a: k, b: a, r: 0.08 * s });
    caps.push({ a: l.foot.localToWorld(V(0, -0.07, 0)), b: l.foot.localToWorld(V(0, 0.08, 0)), r: 0.07 * s, foot: true });
  }
  for (const arm of [f.armL, f.armR]) {
    const sh = arm.top.localToWorld(V(0, 0, 0)), el = arm.joint.localToWorld(V(0, 0, 0)), hd = handWorld(arm);
    const tip = arm.joint.localToWorld(V(0, -B_LEN - 0.07, 0)); // the mitten hand reaches a little past the wrist
    caps.push({ a: sh, b: el, r: 0.07 * s, arm: true }); caps.push({ a: el, b: tip, r: 0.075 * s, arm: true });
  }
  return caps;
}

export const v3 = new THREE.Vector3();
export function toScreen(obj, cam, off = [0, 0, 0]) {
  (obj.isVector3 ? v3.copy(obj) : obj.getWorldPosition(v3)).add(V(...off)); v3.project(cam);
  return [(v3.x * 0.5 + 0.5) * W, (-v3.y * 0.5 + 0.5) * H];
}
export function camShot(cam, a, b, look, k, lookB) {
  cam.position.set(...a.map((v, i) => lerp(v, b[i], k)));
  if (lookB) cam.lookAt(...look.map((v, i) => lerp(v, lookB[i], k))); else cam.lookAt(...look);
}
// pick the active shot from a cut list [[t, shotName], ...]
export function shotAt(cuts, t, end) {
  let ci = 0; for (let i = 0; i < cuts.length; i++) if (t >= cuts[i][0]) ci = i;
  const t0 = cuts[ci][0], t1 = cuts[ci + 1] ? cuts[ci + 1][0] : end;
  if (typeof window !== "undefined") window.SHOTNAME = cuts[ci][1];
  return { name: cuts[ci][1], k: smooth(t0, t1, t), t0, t1, i: ci };
}

// potted plant: tapered pot with rim and soil, arching stems ending in smooth leaves (size = overall height)
export function makePlant(size = 1.2, potColor = 0xd8d2c8, leafColor = 0x3f6a36, seed = 3) {
  const g = new THREE.Group(), R = rng(seed * 7919 + 11), ph = size * 0.32, pr = size * 0.17;
  const potM = mat(potColor, 0.6);
  add(g, cyl(pr, pr * 0.78, ph, potM, 48), 0, ph / 2, 0);
  add(g, new THREE.Mesh(new THREE.TorusGeometry(pr * 0.98, pr * 0.07, 12, 48), potM), 0, ph, 0, { rx: Math.PI / 2 });
  add(g, cyl(pr * 0.94, pr * 0.94, 0.02, mat(0x2a1e16, 1), 40), 0, ph - 0.03, 0);
  const leafM = mat(leafColor, 0.55), stemM = mat(0x355a2c, 0.7), leafG = new THREE.SphereGeometry(1, 24, 12);
  const n = Math.round(14 + size * 10);
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996 + R() * 0.4, up = 0.35 + R() * 0.55, len = size * (0.28 + R() * 0.32);
    const dir = V(Math.cos(a) * Math.cos(up), Math.sin(up), Math.sin(a) * Math.cos(up));
    const base = V(0, ph - 0.02, 0), tip = base.clone().addScaledVector(dir, len);
    tip.y += len * 0.15 - (1 - up) * len * 0.25;
    const curve = new THREE.QuadraticBezierCurve3(base, base.clone().addScaledVector(dir, len * 0.5).add(V(0, len * 0.35, 0)), tip);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.006 + size * 0.003, 6), stemM));
    const leaf = new THREE.Mesh(leafG, leafM), lw = size * (0.045 + R() * 0.02);
    leaf.scale.set(lw, lw * 0.18, size * (0.11 + R() * 0.05));
    leaf.position.copy(tip); leaf.lookAt(tip.clone().add(V(dir.x, dir.y * 0.2 - 0.25, dir.z)));
    g.add(leaf);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// round the corners of a walking path (polyline of [x,z]) so heading turns gradually instead of snapping
export function roundPath(pts, r = 0.4, n = 6) {
  if (pts.length < 3) return pts.map(p => [p[0], p[1]]);
  const out = [[pts[0][0], pts[0][1]]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], [cx, cz] = pts[i + 1];
    const la = Math.hypot(bx - ax, bz - az), lc = Math.hypot(cx - bx, cz - bz), rr = Math.min(r, la * 0.45, lc * 0.45);
    const p0 = [bx + (ax - bx) / la * rr, bz + (az - bz) / la * rr], p2 = [bx + (cx - bx) / lc * rr, bz + (cz - bz) / lc * rr];
    for (let k = 0; k <= n; k++) { const u = k / n, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u; out.push([a * p0[0] + b * bx + c * p2[0], a * p0[1] + b * bz + c * p2[1]]); }
  }
  out.push([pts[pts.length - 1][0], pts[pts.length - 1][1]]);
  return out;
}
// keep a shot at least minD from its look point (big heads fill the frame when closer); S = [from, to, look, lookB?]
export function fitShot(S, minD = 2.7) {
  const L = S[2], out = S.slice();
  for (const i of [0, 1]) {
    const d = Math.hypot(S[i][0] - L[0], S[i][1] - L[1], S[i][2] - L[2]);
    if (d < minD && d > 1e-3) { const k = minD / d; out[i] = S[i].map((v, j) => L[j] + (v - L[j]) * k); }
  }
  return out;
}
