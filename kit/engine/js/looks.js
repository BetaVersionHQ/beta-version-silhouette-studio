// Figure looks. film.json "look": "black" (default: dark silhouettes with a light rim and glowing eyes) or "white" (off-white
// figures with a soft dark rim and dark eyes with brows, lit by the nearest warm practical light, in a darker room).
// story.py LOOKS = {who: 'black' | 'white' | 'shadow'} overrides one figure. 'shadow' is the shadow self: a solid black
// figure with a red rim glow and red eyes, whose lines get red captions.
import { THREE, V, FILM, TL, clamp, lerp, rimMaterial } from './core.js';

export const LOOK = FILM.look === 'white' ? 'white' : 'black';
export const LOOKS = TL.looks || {};
export const lookOf = name => LOOKS[name] || LOOK;
export const SHADOW_RIM = 0xff2d48;

// off-white body: wrapped light from one key (a practical lamp, set every frame by updateLooks), a warm ambient floor so it
// never goes grey, and a soft dark rim from the edge angle (the outline of a 2D drawing, without a hard ink line)
export function whiteMaterial({ color = 0xf3ece0, rim = 0x241d19, rimPow = 2.2, rimStr = 0.85, amb = 0.36, key = 0.8 } = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uCol: { value: new THREE.Color(color) }, uRim: { value: new THREE.Color(rim) }, uPow: { value: rimPow }, uStr: { value: rimStr },
      uLightPos: { value: V(0, 2.6, 0) }, uLightCol: { value: new THREE.Color(0xffd6a8) }, uKey: { value: key }, uAmb: { value: amb },
    },
    vertexShader: `
      varying vec3 vN; varying vec3 vP;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vP = wp.xyz; vN = normalize(transpose(inverse(mat3(modelMatrix))) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform vec3 uCol, uRim, uLightPos, uLightCol; uniform float uPow, uStr, uKey, uAmb;
      varying vec3 vN; varying vec3 vP;
      void main() {
        vec3 n = normalize(vN); vec3 v = normalize(cameraPosition - vP);
        vec3 L = uLightPos - vP; float d = length(L); L /= d;
        float wrap = clamp(dot(n, L) * 0.5 + 0.5, 0.0, 1.0);
        float fall = 1.0 / (1.0 + 0.18 * d * d);
        vec3 c = uCol * (uAmb + uKey * wrap * wrap * fall * uLightCol);
        float f = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), uPow);
        gl_FragColor = vec4(mix(c, uRim, clamp(f * uStr, 0.0, 1.0)), 1.0);
      }`,
  });
  m.userData.look = 'white';
  return m;
}
export const shadowMaterial = () => rimMaterial({ rim: SHADOW_RIM, power: 4.2, strength: 1.8, base: 0x010001, lightStr: 0 });

// face parts per look. White: dark eye dots and a brow stroke over each eye (blink() moves them with f.brow and f.lid).
// Shadow: red eyes. Black: unchanged (glowing eyes, no brows).
export function applyLook(f, look) {
  f.look = look;
  if (look === 'white') {
    f.eyeMat.color.set(0x1a1411); f.eyeCol = null;
    const bm = new THREE.MeshBasicMaterial({ color: 0x1f1813 }), C = V(0, 0.36, 0), R = 0.34;
    f.brows = [];
    for (const sx of [-1, 1]) {
      const p = V(sx * 0.11, 0.445, 0); p.z = Math.sqrt(R * R - p.x * p.x - (p.y - C.y) ** 2);
      const nrm = p.clone().sub(C).normalize(), g = new THREE.Group();
      g.position.copy(C).addScaledVector(nrm, R + 0.004); g.quaternion.setFromUnitVectors(V(0, 0, 1), nrm);
      const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.0115, 0.072, 6, 16), bm); s.rotation.z = Math.PI / 2; s.scale.z = 0.5; g.add(s);
      g.userData.sx = sx; g.userData.y0 = g.position.y; f.headPivot.add(g); f.brows.push(g);
    }
  } else if (look === 'shadow') {
    f.eyeCol = new THREE.Color(1.0, 0.16, 0.22).multiplyScalar(1.6); f.eyeMat.color.copy(f.eyeCol);
  }
  f.brow = 0; f.lid = 0; f.face = (open, c) => faceParts(f, open, c);
  return f;
}
// called by blink(): eyelids (f.lid 0..1 lowers them) and brows (f.brow -1 angry .. 0 neutral .. 1 worried/sad)
export function faceParts(f, open, c) {
  const lid = clamp(f.lid || 0);
  for (const e of f.eyes) e.scale.set(1, (c * open + (1 - open) * 0.1) * (1 - lid * 0.55), 0.5);
  if (f.brows) for (const g of f.brows) {
    const b = clamp(f.brow || 0, -1, 1), sx = g.userData.sx;
    g.rotation.z = 0; g.quaternion.setFromUnitVectors(V(0, 0, 1), g.position.clone().sub(V(0, 0.36, 0)).normalize());
    g.rotateZ(-sx * b * 0.38); g.position.y = g.userData.y0 + (b > 0 ? b * 0.012 : b * 0.008) - lid * 0.012;
  }
  if (f.look === 'white') return;
  const k = lerp(0.12, 1, clamp(open * 1.5));
  if (f.eyeCol) f.eyeMat.color.copy(f.eyeCol).multiplyScalar(k); else f.eyeMat.color.setScalar(lerp(0.12, f.eyeBase ?? 1, clamp(open * 1.5)));
}

// once per frame (main.js): aim each white figure's key at the strongest practical light near it (point and spot lights,
// weighted by distance), and in a white film keep the room dark: wall and furniture colours are dimmed once per scene and
// the fill lights (hemisphere, ambient, directional) run at 25 % so the practicals make warm pools on near-black rooms.
const DIM_ALBEDO = 0.4, DIM_FILL = 0.25;
export function updateLooks(scene, figs) {
  if (!scene) return;
  const U = scene.userData;
  if (!U.lookLights) { U.lookLights = []; scene.traverse(o => { if (o.isPointLight || o.isSpotLight) U.lookLights.push(o); }); }
  if (LOOK === 'white') {
    if (!U.lookDim) { U.lookDim = true; dimRoom(scene, figs); }
    scene.traverse(o => { if (!(o.isHemisphereLight || o.isAmbientLight || o.isDirectionalLight)) return;
      if (o.intensity !== o.userData.lookSet) o.userData.lookBase = o.intensity;
      o.intensity = o.userData.lookBase * DIM_FILL; o.userData.lookSet = o.intensity; });
  }
  for (const f of Object.values(figs || {})) {
    if (f.look !== 'white' || !f.g.visible) continue;
    const h = f.head.getWorldPosition(V(0, 0, 0)); let best = null, bs = 0;
    for (const l of U.lookLights) {
      let vis = l.visible; for (let p = l.parent; p && vis; p = p.parent) vis = p.visible; if (!vis || l.intensity <= 0) continue;
      const p = l.getWorldPosition(V(0, 0, 0)), s = l.intensity / (1 + p.distanceToSquared(h));
      if (s > bs) { bs = s; best = [p, l.color]; }
    }
    const u = f.mat.uniforms; if (!u?.uLightPos) continue;
    if (best) { u.uLightPos.value.copy(best[0]); u.uLightCol.value.copy(best[1]); }
  }
}
function dimRoom(scene, figs) {
  const skip = new Set(); for (const f of Object.values(figs || {})) f.g.traverse(o => skip.add(o));
  const done = new Set();
  scene.traverse(o => {
    if (!o.isMesh || skip.has(o) || o.userData.brand) return;
    for (const m of [].concat(o.material || [])) {
      if (done.has(m) || !m.color || m.isMeshBasicMaterial || m.isShaderMaterial || m.isSpriteMaterial) continue;
      done.add(m); m.color.multiplyScalar(DIM_ALBEDO);
    }
  });
}
