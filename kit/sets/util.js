// Small helpers shared by the exterior and interior sets: a gradient sky dome with stars, a soft glow sprite,
// sand texture, desert shrubs, a wooden power pole, and body/head points for hand placement.
import { THREE, V, rng, mat, box, cyl, add, textTex } from './core.js';

export function makeSky(scene, { top = 0x1a2340, mid = 0x5a6a8a, low = 0xc89a7a, stars = 0 } = {}) {
  const u = { cTop: { value: new THREE.Color(top) }, cMid: { value: new THREE.Color(mid) }, cLow: { value: new THREE.Color(low) } };
  const m = new THREE.ShaderMaterial({ uniforms: u, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 cTop, cMid, cLow; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = h > 0.12 ? mix(cMid, cTop, smoothstep(0.12, 0.75, h)) : mix(cLow, cMid, smoothstep(-0.05, 0.12, h)); gl_FragColor = vec4(c, 1.0); }` });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(380, 48, 24), m); sky.userData.camSkip = true; sky.userData.shell = true; sky.name = 'sky'; scene.add(sky);
  // the dome travels with the camera, so wide shots far from the origin never see past it
  sky.frustumCulled = false; sky.onBeforeRender = (r, sc, cam) => { sky.position.copy(cam.position); sky.updateMatrixWorld(true); if (sky.stars) { sky.stars.position.copy(cam.position); sky.stars.updateMatrixWorld(true); } };
  sky.set = (a, b, c) => { u.cTop.value.set(a); u.cMid.value.set(b); u.cLow.value.set(c); };
  if (stars) {
    const R = rng(5), pos = []; for (let i = 0; i < stars; i++) { const a = R() * 6.283, e = 0.08 + R() * 1.3, r = 360; pos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.3, sizeAttenuation: false, transparent: true, opacity: 0.8, fog: false, depthWrite: false }));
    pts.userData.camSkip = true; pts.frustumCulled = false; scene.add(pts); sky.stars = pts;
  }
  return sky;
}
export function glowSprite(color = 'rgba(255,214,160,1)', size = 30) {
  const tex = textTex((x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, color); g.addColorStop(0.3, color.replace(/[\d.]+\)$/, '.45)')); g.addColorStop(1, color.replace(/[\d.]+\)$/, '0)')); x.fillStyle = g; x.fillRect(0, 0, w, h); }, 128, 128);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); s.scale.set(size, size, 1); s.userData.camSkip = true; return s;
}
export function sandTex(base = '#b8986c', seed = 3, n = 9000) {
  const t = textTex((c, w, h) => { c.fillStyle = base; c.fillRect(0, 0, w, h); const R = rng(seed);
    for (let i = 0; i < n; i++) { const v = R(); c.fillStyle = v < 0.5 ? `rgba(90,60,30,${0.08 + R() * 0.12})` : `rgba(255,235,200,${0.06 + R() * 0.1})`; c.fillRect(R() * w, R() * h, 1 + R() * 3, 1 + R() * 3); } }, 512, 512);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
export function makeSage(seed = 1, s = 1) {
  const g = new THREE.Group(), R = rng(seed + 11), m = mat(R() < 0.5 ? 0x7a8a5a : 0x8a8a62, 0.95);
  for (let i = 0; i < 6; i++) add(g, new THREE.Mesh(new THREE.SphereGeometry(0.22 * s * (0.7 + R() * 0.6), 14, 10), m), (R() - 0.5) * 0.5 * s, 0.14 * s + R() * 0.12 * s, (R() - 0.5) * 0.5 * s, { cast: true });
  g.name = 'sage'; return g;
}
export function makePole(h = 8) {
  const g = new THREE.Group(), w = mat(0x5a4632, 0.9); add(g, cyl(0.12, 0.15, h, w, 10), 0, h / 2, 0, { cast: true }); add(g, box(1.8, 0.12, 0.12, w), 0, h - 0.5, 0);
  for (const x of [-0.75, 0.75]) add(g, cyl(0.04, 0.04, 0.12, mat(0x7a9aa8, 0.3)), x, h - 0.38, 0); g.name = 'pole'; return g;
}
// a point in a figure's body space (x right, y up from the hips' floor, z forward) and its head position, in world space
export const B = (f, x, y, z) => f.body.localToWorld(V(x, y, z));
export const head = f => f.head.getWorldPosition(V(0, 0, 0));
