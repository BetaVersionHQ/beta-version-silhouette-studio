// Beta Version Silhouette Studio - film driver. Picks the set module for each scene (timeline scene.set -> js/set_<set>.js),
// renders it, then draws the film pass (fade, vignette, grain) and the Beta Version corner watermark INTO the WebGL frame,
// and the 2D layer on top (date chip, captions, narration, paper/phone overlays, title and end cards).
import { THREE, W, H, FILM, FORMAT, PORTRAIT, WM, TL, clamp, smooth, win, $, toScreen, bodyCaps, BRAND_IMG } from './core.js';
import { DATA as BRAND } from './brand.js';
import { LOOKS, updateLooks } from './looks.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

// page size and layout follow the film format (16:9 long, 9:16 short)
document.documentElement.classList.add(FORMAT);
for (const el of [document.documentElement, document.body]) { el.style.width = W + 'px'; el.style.height = H + 'px'; }

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
$('stage').appendChild(renderer.domElement);
// AA mode (?aa=msaa|fxaa): FXAA after tone mapping is the fast default; MSAA on the half-float target costs ~40 % on a CPU
const QS = new URLSearchParams(location.search), AA = QS.get('aa') || window.AA_MODE || 'fxaa';
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: AA === 'msaa' ? 4 : 0 }));
const rp = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera()); composer.addPass(rp);
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.6, 0.5, 0.75); composer.addPass(bloom);
composer.addPass(new OutputPass());
const DPR = window.devicePixelRatio || 1; if (DPR !== 1) { renderer.setPixelRatio(DPR); composer.setPixelRatio(DPR); }   // SS_SCALE footage
if (AA === 'fxaa') { const fx = new ShaderPass(FXAAShader); fx.material.uniforms.resolution.value.set(1 / (W * DPR), 1 / (H * DPR)); composer.addPass(fx); }
if (AA === 'fxaa') bloom.setSize(W * DPR / 2, H * DPR / 2);

// ---- film pass + watermark, drawn straight onto the canvas after the scene ----
const ovScene = new THREE.Scene(), ovCam = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
const filmMat = new THREE.ShaderMaterial({
  transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
  uniforms: { uFade: { value: 0 }, uSeed: { value: 0 }, uAspect: { value: W / H } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `varying vec2 vUv; uniform float uFade, uSeed, uAspect;
    float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed) * 43758.5453); }
    void main() {
      vec2 q = (vUv - 0.5) * 2.0; float r = length(q * vec2(1.0, 1.0));
      float vig = smoothstep(0.48 * 1.41, 1.41, r) * 0.55;          // the old radial vignette: clear centre, 55 % at the corners
      float a = 1.0 - (1.0 - uFade) * (1.0 - vig);                   // black: fade and vignette together
      float g = 0.035 * (1.0 - a);                                    // film grain on what is left
      float n = h(floor(gl_FragCoord.xy));
      float A = 1.0 - (1.0 - a) * (1.0 - g);
      gl_FragColor = vec4(vec3(n * g / max(A, 1e-4)), A);
    }`,
});
const filmQuad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), filmMat); filmQuad.position.set(0.5, 0.5, 0); ovScene.add(filmQuad);
const wmTex = new THREE.Texture(BRAND_IMG.watermark); wmTex.colorSpace = THREE.SRGBColorSpace; wmTex.needsUpdate = true;
const wmMat = new THREE.MeshBasicMaterial({ map: wmTex, transparent: true, opacity: 0.7, depthTest: false, depthWrite: false, toneMapped: false });
const wm = new THREE.Mesh(new THREE.PlaneGeometry(WM[1] - WM[0], WM[3] - WM[2]), wmMat);
wm.position.set((WM[0] + WM[1]) / 2, 1 - (WM[2] + WM[3]) / 2, 0.1); wm.renderOrder = 2; if (FILM.watermark !== false) ovScene.add(wm);
function drawOverlay(fade, t) {
  filmMat.uniforms.uFade.value = clamp(fade); filmMat.uniforms.uSeed.value = (t * 977) % 97;
  const ac = renderer.autoClear; renderer.autoClear = false; renderer.setRenderTarget(null);
  const tm = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping;
  renderer.render(ovScene, ovCam); renderer.toneMapping = tm; renderer.autoClear = ac;
}

const MODS = {}, SCENE_MOD = {};
for (const s of TL.scenes) if (s.set) SCENE_MOD[s.name] = 'set_' + s.set;
for (const m of new Set(Object.values(SCENE_MOD))) {
  try { MODS[m] = await import(`./${m}.js`); } catch (e) { console.log('module failed', m, e.message, e.stack); }
}
$('tTitle').textContent = FILM.title; $('tTag').textContent = FILM.tagline || '';
$('eLine').textContent = FILM.endLine || ''; $('eMeta').textContent = FILM.endMeta || '';
for (const id of ['tMark', 'eMark']) $(id).src = BRAND_IMG[id === 'tMark' ? 'mark' : 'wordmark']?.src || (id === 'tMark' ? BRAND.MARK : BRAND.WORDMARK);
$('phMark').src = BRAND_IMG.mark?.src || BRAND.MARK;

// captions keep out of the watermark corner and inside the frame
const MARK_BOX = [WM[0] * W, WM[1] * W, WM[2] * H, WM[3] * H];
const FEM = new Set(FILM.female || []), KIDS = new Set(FILM.kids || []);
function caption(t, cam, heads, fade) {
  const cap = $('cap'), sub = $('sub');
  sub.style.opacity = 0; cap.style.opacity = 0;
  const l = TL.lines.find(l => t >= l.start - 0.05 && t < l.start + l.dur + 0.35);
  if (!l || l.scene === 'opening') return;
  const shadow = LOOKS[l.who] === 'shadow';
  const o = smooth(l.start - 0.05, l.start + 0.2, t) * (1 - smooth(l.start + l.dur + 0.1, l.start + l.dur + 0.35, t)) * (1 - fade);
  const off = l.voice !== l.who; // narration, phone, radio, through a door
  const h = heads && heads[l.who];
  if (!off && h && cam) {
    const p = h.isVector3 ? h.clone() : h.getWorldPosition(new THREE.Vector3()); p.y += 0.95;
    const v = p.clone().project(cam), onScreen = v.z < 1 && Math.abs(v.x) < 0.95 && v.y < 1.1 && v.y > -0.9;
    if (onScreen) {
      const [x, y] = toScreen(p, cam);
      cap.className = 'cap' + (shadow ? ' shadow' : KIDS.has(l.who) ? ' kid' : FEM.has(l.who) ? ' f' : '');
      if (cap._t !== l.text) { cap.textContent = l.text; cap._t = l.text; }
      const cw = cap.offsetWidth, ch = cap.offsetHeight;
      const cx = clamp(x, cw / 2 + 16, W - cw / 2 - 16);
      let cy = clamp(y, ch + 24, H - 60);
      // the caption box spans [cx - cw/2, cx + cw/2] x [cy - ch, cy]; push it below the watermark if they meet
      if (cx + cw / 2 > MARK_BOX[0] - 8 && cy - ch < MARK_BOX[3] + 8) cy = MARK_BOX[3] + 8 + ch;
      cap.style.opacity = o; cap.style.left = cx + 'px'; cap.style.top = cy + 'px';
      return;
    }
  }
  if (sub._t !== l.text) { sub.textContent = l.text; sub._t = l.text; }
  sub.className = l.voice === 'narr' ? 'narr' : shadow ? 'shadow' : off ? 'phone' : ''; sub.style.opacity = o;
}
const esc = x => String(x || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function openingHTML(O) {
  const text = esc(O.text), key = esc(O.key), i = key ? text.indexOf(key) : -1;
  if (i < 0) return text;
  return text.slice(0, i) + `<span class="key" style="color:${esc(O.color || '#ff9a3c')}">${key}</span>` + text.slice(i + key.length);
}
function sceneAt(t) { for (const s of TL.scenes) if (t >= s.start && t < s.end) return s; return TL.scenes[TL.scenes.length - 1]; }
const CARD = 0x0b0d14;

window.renderAt = (t) => {
  const s = sceneAt(t);
  for (const id of ['titleCard', 'endCard', 'openCard', 'paper', 'paperBg', 'phone']) $(id).style.opacity = 0;
  $('hud').classList.remove('hide'); $('chip').style.opacity = 0;
  let fade = 0;
  const R = { fade: 0, exposure: 1.15, bloom: [0.55, 0.78, 0.5] };
  const mod = MODS[SCENE_MOD[s.name]];
  window.SHOTNAME = ''; window.SHOTEXPLICIT = false;
  if (s.name === 'opening') {
    // the opening card: one narration line on black with one coloured keyword, then the first scene fades in from black
    const O = TL.opening || {}, el = $('oText');
    if (el._t !== O.text) { el._t = O.text; el.innerHTML = openingHTML(O); }
    $('openCard').style.opacity = 1; el.style.opacity = smooth(s.start + 0.3, s.start + 1.1, t) * (1 - smooth(s.end - 0.9, s.end - 0.2, t));
    renderer.setClearColor(0x000000); renderer.clear(); window.LAST = null; $('hud').classList.add('hide');
  } else if (s.name === 'title' || s.name === 'endcard') {
    // cards: the canvas is the card background, so the watermark stays in the frame on the cards too
    const card = $(s.name === 'title' ? 'titleCard' : 'endCard'), inner = card.querySelector('.inner');
    card.style.opacity = 1;
    if (s.name === 'title') { const k = smooth(s.start + 0.3, s.start + 1.6, t); inner.style.opacity = k * (1 - smooth(s.end - 1.0, s.end - 0.2, t)); inner.style.transform = `translateY(${(1 - k) * 24}px)`; }
    else inner.style.opacity = smooth(s.start + 0.4, s.start + 1.4, t) * (1 - smooth(s.end - 1.0, s.end, t));
    renderer.setClearColor(CARD); renderer.clear(); window.LAST = null;
    fade = s.name === 'endcard' ? 1 - smooth(s.start, s.start + 0.8, t) : 0;
    $('hud').classList.add('hide');
  } else if (mod) {
    renderer.setClearColor(0x000000);
    const hud = mod.render(t, s.name, R) || {};
    updateLooks(R.scene, hud.figs || mod.FIGS);   // white figures face their practical light; a white film keeps rooms dark
    if (window.DBG) { R.camera.position.set(...window.DBG.pos); R.camera.lookAt(...window.DBG.look); if (window.DBG.fov) { R.camera.fov = window.DBG.fov; R.camera.updateProjectionMatrix(); } R.camera.updateMatrixWorld(true); R.fade = 0; }
    rp.scene = R.scene; rp.camera = R.camera; window.LAST = { cam: R.camera, scene: R.scene, fade: R.fade || 0, figs: hud.figs || mod.FIGS, props: hud.props || [] };
    renderer.toneMappingExposure = R.exposure; [bloom.strength, bloom.threshold, bloom.radius] = R.bloom; if (window.NOBLOOM) bloom.strength = 0;
    if (!window.NORENDER) composer.render();
    fade = R.fade || 0;
    caption(t, R.camera, hud.heads, fade);
    // scene chip comes from the story calendar (timeline), never from the set module
    if (s.chip && !hud.noChip) { $('chip').textContent = s.chip; $('chip').style.opacity = win(t, s.start + 0.7, s.start + 4.6, 0.4, 0.6) * (1 - fade); }
    if (R.paper && R.paper.show > 0) {
      const p = $('paper'); if (p._h !== R.paper.html) { p.innerHTML = R.paper.html; p._h = R.paper.html; } p.className = R.paper.cls || '';
      p.style.opacity = R.paper.show; $('paperBg').style.opacity = R.paper.show; $('hud').classList.add('hide');
    }
    if (R.phoneUI && R.phoneUI.show > 0) {
      const P = R.phoneUI; $('phone').style.opacity = P.show; $('phWho').textContent = P.who; $('phSt').textContent = P.status || '';
      $('phAv').textContent = P.initial || P.who[0]; $('phAv').style.background = P.color || '#3a6fd8'; $('hud').classList.add('hide');
      fade = Math.max(fade, P.show * 0.6);
    }
  } else { renderer.setClearColor(0x200000); renderer.clear(); window.LAST = null; }
  if (!window.NORENDER) drawOverlay(fade, t);
  window.FADE = fade;
};
window.REN = renderer; window.COMPOSER = composer; window.BLOOM = bloom; window.THREE = THREE; window.bodyCaps = bodyCaps; window.sceneAt = sceneAt; window.MODS = MODS; window.SCENE_MOD = SCENE_MOD; window.TLEND = TL.end; window.TL = TL;
window.FORMAT = FORMAT; window.WM = WM; window.PORTRAIT = PORTRAIT;
document.fonts.ready.then(() => { window.renderAt(0.5); window.READY = true; });
