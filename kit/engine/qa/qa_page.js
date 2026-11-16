// Page-side QA checks, injected by qa.js after the film page is READY. window.QA.at(t) poses the film at t without
// drawing (NORENDER) and returns a list of problems: [{k: kind, sev: 'fail'|'warn', who, msg}].
// Kinds: feet (floating or sunk), wall (inside an obstacle or outside the walkable area), overlap (two bodies in one
// spot), slide (a planted foot skating), prop (floating, or inside a body), cam (inside or touching geometry),
// speaker (the person talking is hidden behind something), chip (date chip text differs from the calendar), lens (someone
// fills the frame or walks into the lens), brand (the corner watermark covers a face, or an in-world brand piece covers
// one). brandseen reports the biggest in-world brand piece in view (qa.js turns a scene without one into a fail).
(() => {
  const T = window.THREE, V = (x, y, z) => new T.Vector3(x, y, z);
  const rc = new T.Raycaster();
  const CAL = window.QA_CAL || {};
  const isFigMesh = o => { for (let p = o; p; p = p.parent) if (p.userData.qaFig) return p.userData.qaFig; return null; };
  const hidden = o => { for (let p = o; p; p = p.parent) if (!p.visible) return true; return false; };
  const skipMesh = o => !o.isMesh || hidden(o) || o.userData.camSkip || o.userData.shell || o.name === 'sky' || o.material?.transparent && !o.userData.camBlock || o.material?.type === 'ShaderMaterial' || o.material?.type === 'SpriteMaterial';
  function solids(scene) { const out = []; scene.traverse(o => { if (o.isMesh && !skipMesh(o)) out.push(o); }); return out; }
  // surfaces a prop can rest on: solids plus the ground and sea (shell meshes), never the sky
  // what a foot can stand on: not carried props and not things people only stand beside (a car body overhangs its sill)
  const noSupport = o => { for (let p = o; p; p = p.parent) if (p.userData.tracked || p.userData.overhang) return true; return false; };
  function supports(scene, feet = false) { const out = []; scene.traverse(o => { if (o.isMesh && !hidden(o) && o.name !== 'sky' && !o.userData.camSkip && (!skipMesh(o) || o.userData.shell) && !(feet && noSupport(o))) out.push(o); }); return out; }
  function tagFigs(figs) { for (const [n, f] of Object.entries(figs || {})) f.g.userData.qaFig = n; }
  function footY(f, l) { return l.foot.localToWorld(V(0, 0, 0)).y - 0.055 * f.s; }
  function footP(l) { return l.foot.localToWorld(V(0, 0, 0)); }
  function actorFor(stage, f, t) { if (!stage) return null; let best = null; for (const a of Object.values(stage.actors)) if (a.f === f && a._t === t && a.cur) best = a; return best; }
  function inObs(stage, x, z, r) {
    for (const o of stage.obs || []) {
      if (o.k === 'c') { if (Math.hypot(x - o.x, z - o.z) < o.r + r - 0.06) return o.tag || 'obstacle'; continue; }
      const c = Math.cos(-(o.ry || 0)), s = Math.sin(-(o.ry || 0)), dx = x - o.x, dz = z - o.z, lx = dx * c - dz * s, lz = dx * s + dz * c;
      const qx = Math.max(0, Math.abs(lx) - o.w / 2), qz = Math.max(0, Math.abs(lz) - o.d / 2);
      if (Math.hypot(qx, qz) < r - 0.06) return o.tag || 'obstacle';
    }
    return null;
  }
  // everything about each visible figure at time t (positions, mode, planted feet)
  function figState(t) {
    const L = window.LAST; if (!L) return {};
    const stage = L.scene.userData.stage, out = {};
    for (const [n, f] of Object.entries(L.figs || {})) {
      if (!f.g.visible || f.qaSkip) continue; f.g.updateMatrixWorld(true);
      const a = actorFor(stage, f, t); const st = a?.cur;
      const flAt = (x, z) => !st ? 0 : a.floorAt ? a.floorAt(x, z) : stage?.floorY ? stage.floorY(x, z) : 0;
      const fl = flAt(st?.x ?? 0, st?.z ?? 0), ty = f.torso.getWorldPosition(V(0, 0, 0)).y;
      // what is really under each foot: the first surface below hip height at the foot (floors, stair treads, decks, grass)
      const under = (x, z, y0) => { if (!st) return null; rc.set(V(x, Math.min(ty, y0 + 0.3), z), V(0, -1, 0)); rc.far = 4; const h = rc.intersectObjects(supports(L.scene, true), false).find(h => !isFigMesh(h.object)); return h ? h.point.y : null; };
      // a foot straddling a tread edge rests on the higher tread: either tread under it counts (whichever the foot is on)
      const flFoot = (x, z) => Math.max(flAt(x, z), flAt(x + 0.06, z), flAt(x - 0.06, z), flAt(x, z + 0.06), flAt(x, z - 0.06));
      const feet = [f.legL, f.legR].map(l => { const p = footP(l); const y = footY(f, l); const a0 = flAt(p.x, p.z), a1 = flFoot(p.x, p.z); return { p, y, fl: Math.abs(y - a0) <= Math.abs(y - a1) ? a0 : a1, ground: [[0, 0], [0.06, 0], [-0.06, 0], [0, 0.06], [0, -0.06]].map(([dx, dz]) => under(p.x + dx, p.z + dz, y)).filter(g => g !== null).sort((g1, g2) => Math.abs(y - g1) - Math.abs(y - g2))[0] ?? null }; });
      const gap = Math.min(...feet.map(q => q.y - q.fl)), gg = feet.filter(q => q.ground !== null).map(q => q.y - q.ground), ground = gg.length ? Math.min(...gg) : null;
      out[n] = { f, a, st, fl, gap, ground, feet, hip: f.torso.getWorldPosition(V(0, 0, 0)) };
    }
    return out;
  }
  function checkFigs(t, S, S2, stage, issues) {
    const names = Object.keys(S);
    for (const n of names) {
      const s = S[n], st = s.st; if (!st) continue;
      const standing = st.mode === 'stand' && !st.trans && !s.f.posedDown, walking = !!st.walking;
      const low = Math.min(s.feet[0].y, s.feet[1].y);
      if (standing && st.vis !== false) {
        if (s.gap > 0.05 && !s.f.airborne) issues.push({ k: 'feet', sev: 'fail', who: n, msg: `${n} floating ${s.gap.toFixed(2)} m above the floor` });
        if (s.gap < -0.05) issues.push({ k: 'feet', sev: 'fail', who: n, msg: `${n} sunk ${(-s.gap).toFixed(2)} m into the floor` });
        if (s.ground !== null && Math.abs(s.ground) > 0.07 && !(s.f.airborne && s.ground > 0)) issues.push({ k: 'feet', sev: 'fail', who: n, msg: `${n}'s feet are ${s.ground > 0 ? 'above' : 'below'} the real ground by ${Math.abs(s.ground).toFixed(2)} m` });
        const nearSeat = stage && Object.values(stage.seats || {}).some(q => Math.hypot(st.x - q.fx, st.z - q.fz) < 0.3);
        const hit = stage && !nearSeat && s.fl < 0.15 && inObs(stage, st.x, st.z, 0.2);
        if (hit) issues.push({ k: 'wall', sev: 'fail', who: n, msg: `${n} is inside the ${hit}` });
        if (stage?.walkable && !stage.walkable(st.x, st.z, 0.05)) issues.push({ k: 'wall', sev: 'warn', who: n, msg: `${n} outside the walkable area at (${st.x.toFixed(1)}, ${st.z.toFixed(1)})` });
      }
      // planted feet must not skate: between t and t + 1/30, a foot on the floor moves < 2 cm (standing) or < 4 cm (walking)
      const s2 = S2[n];
      if (s2 && s2.st && !st.trans && !s2.st.trans && !s.f.posedDown && (st.mode === 'stand' || walking) && s2.st.mode === st.mode) {
        const gp = q => q.y - q.fl, lo = gp(s.feet[0]) <= gp(s.feet[1]) ? 0 : 1, lo2 = gp(s2.feet[0]) <= gp(s2.feet[1]) ? 0 : 1;
        for (const i of lo === lo2 ? [lo] : []) {
          const a = s.feet[i], b = s2.feet[i];
          if (a.y - a.fl < 0.008 && b.y - b.fl < 0.008 && Math.abs(gp(s.feet[1 - i]) - gp(a)) > 0.01) {
            const d = Math.hypot(a.p.x - b.p.x, a.p.z - b.p.z), lim = walking ? 0.017 : 0.012;
            if (d > lim) issues.push({ k: 'slide', sev: d > lim * 2 ? 'fail' : 'warn', who: n, msg: `${n} ${i ? 'right' : 'left'} foot slides ${(d * 30).toFixed(2)} m/s while planted`, _f: i, _lim: lim, _p: b.p });
          }
        }
      }
    }
    // two bodies in one place
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      const A = S[names[i]], B = S[names[j]]; if (!A.st || !B.st) continue;
      const d = Math.hypot(A.hip.x - B.hip.x, A.hip.z - B.hip.z);
      // an embrace the set declares (f.hugWith) brings two bodies closer than this on purpose; only flag a real merge then
      const hugging = A.f.hugWith === names[j] || B.f.hugWith === names[i];
      if (d < (hugging ? 0.22 : 0.42) && Math.abs(A.hip.y - B.hip.y) < 1.2) issues.push({ k: 'overlap', sev: 'fail', who: names[i] + '+' + names[j], msg: `${names[i]} and ${names[j]} overlap (${d.toFixed(2)} m apart)` });
    }
  }
  function checkProps(L, S, issues) {
    const stage = L.scene.userData.stage; if (!stage) return;
    const hands = []; for (const [n, f] of Object.entries(L.figs || {})) if (f.g.visible) for (const arm of [f.armL, f.armR]) hands.push([n, arm.joint.localToWorld(V(0, -0.38, 0))]);
    const sol = supports(L.scene);
    for (const p of stage.props) {
      if (hidden(p)) continue; p.updateMatrixWorld(true);
      const bb = new T.Box3().setFromObject(p); if (bb.isEmpty() || bb.max.y < -5) continue;
      const c = bb.getCenter(V(0, 0, 0)), name = p.userData.trackName || p.name;
      let held = null, near = Infinity; for (const [n, h] of hands) { const q = bb.clampPoint(h, V(0, 0, 0)); const dd = q.distanceTo(h); near = Math.min(near, dd); if (dd < 0.12) held = n; }
      if (held) continue;
      const own = new Set(); p.traverse(o => own.add(o));
      rc.set(V(c.x, bb.min.y + 0.03, c.z), V(0, -1, 0)); rc.far = 30;
      const hit = rc.intersectObjects(sol, false).find(h => !own.has(h.object) && !isFigMesh(h.object));
      let gap = hit ? hit.distance - 0.03 : Infinity;
      // hung from something (a hook, a rail, a peg): any of a 5 x 5 grid of up-rays over the footprint meets a support
      if (gap > 0.05) { const sx = bb.max.x - bb.min.x, sz = bb.max.z - bb.min.z; let hung = false;
        for (let i = 0; i < 5 && !hung; i++) for (let j = 0; j < 5 && !hung; j++) { rc.set(V(bb.min.x + sx * (i + 0.5) / 5, c.y, bb.min.z + sz * (j + 0.5) / 5), V(0, 1, 0)); rc.far = bb.max.y - c.y + 0.12; hung = rc.intersectObjects(sol, false).some(h => !own.has(h.object) && !isFigMesh(h.object)); }
        // or a thin hook/peg whose bottom sits inside the top of the prop's box
        if (!hung) { const slab = new T.Box3(V(bb.min.x, bb.max.y - 0.15, bb.min.z), V(bb.max.x, bb.max.y + 0.1, bb.max.z)), mb = new T.Box3();
          for (const m of sol) { if (own.has(m) || isFigMesh(m) || m.userData.shell) continue; mb.setFromObject(m); if (mb.min.y > c.y && mb.min.y < bb.max.y + 0.02 && mb.intersectsBox(slab)) { hung = true; break; } } }
        if (p.userData.qaHung) hung = true;   // hung on slings or a cable the set declares (lines are not meshes)
        if (hung) gap = 0;
        // or resting at a few points (a kite across two sawhorses, a board leaning in a corner): any of an 11 x 11 grid of down-rays from the box bottom lands within 8 cm
        if (!hung) { for (let i = 0; i < 11 && gap > 0.05; i++) for (let j = 0; j < 11 && gap > 0.05; j++) { rc.set(V(bb.min.x + sx * (i + 0.5) / 11, bb.min.y + 0.03, bb.min.z + sz * (j + 0.5) / 11), V(0, -1, 0)); rc.far = 0.11; if (rc.intersectObjects(sol, false).some(h => !own.has(h.object) && !isFigMesh(h.object))) gap = 0; } } }
      if (gap > 0.05) issues.push({ k: 'prop', sev: near < 0.35 ? 'warn' : 'fail', who: name, msg: `${name} floating ${gap === Infinity ? 'in the air' : gap.toFixed(2) + ' m above ' + (hit.object.name || 'the surface')}` });
      for (const [n, s] of Object.entries(S)) if (Math.hypot(c.x - s.hip.x, c.z - s.hip.z) < 0.16 && Math.abs(c.y - s.hip.y) < 0.35) issues.push({ k: 'prop', sev: 'fail', who: name, msg: `${name} is inside ${n}'s body` });
    }
  }
  function checkCam(L, issues) {
    const cam = L.cam, sol = solids(L.scene), o = cam.position.clone();
    const dirs = [V(1, 0, 0), V(-1, 0, 0), V(0, 1, 0), V(0, -1, 0), V(0, 0, 1), V(0, 0, -1), cam.getWorldDirection(V(0, 0, 0))];
    for (const d of dirs) {
      rc.set(o, d.normalize()); rc.far = 100; const h = rc.intersectObjects(sol, false).find(h => !isFigMesh(h.object)); if (!h) continue;
      const side = h.object.material.side;
      if (h.face && side === T.FrontSide) { const n = h.face.normal.clone().transformDirection(h.object.matrixWorld); if (n.dot(d) > 0.05) { issues.push({ k: 'cam', sev: 'fail', who: 'camera', msg: `camera is inside ${h.object.name || h.object.parent?.name || 'a mesh'}` }); return; } }
      if (h.distance < 0.06) { issues.push({ k: 'cam', sev: 'warn', who: 'camera', msg: `camera touching ${h.object.name || h.object.parent?.name || 'geometry'}` }); return; }
    }
  }
  function checkSpeaker(t, L, issues) {
    const l = window.TL.lines.find(l => t > l.start + 0.3 && t < l.start + l.dur - 0.6); if (!l || l.voice !== l.who || window.SHOTINSERT) return;
    const f = (L.figs || {})[l.who]; if (!f || !f.g.visible) return;
    const head = f.head.getWorldPosition(V(0, 0, 0)), v = head.clone().project(L.cam);
    if (!(v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1)) { issues.push({ k: 'speaker', sev: 'info', who: l.who, msg: `${l.who} speaking off-screen` }); return; }
    // five rays over the face (centre and four points 12 cm out): hidden only when most are blocked, so a thin window bar
    // or a railing across part of the head is not a fail
    const o = L.cam.position.clone(), sol = solids(L.scene), camR = V(1, 0, 0).applyQuaternion(L.cam.quaternion), camU = V(0, 1, 0).applyQuaternion(L.cam.quaternion);
    let blocked = 0, first = null;
    for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const p = head.clone().addScaledVector(camR, a * 0.12 * f.s).addScaledVector(camU, b * 0.12 * f.s), d = p.clone().sub(o), dist = d.length(); rc.set(o, d.normalize()); rc.far = dist;
      const bl = rc.intersectObjects(sol, false).filter(h => h.distance < dist - 0.4 * f.s && isFigMesh(h.object) !== l.who);
      if (bl.length) { blocked++; first = first || bl[0]; }
    }
    const blockers = blocked >= 3 ? [first] : [];
    if (blockers.length) { const b = blockers[0].object; issues.push({ k: 'speaker', sev: 'fail', who: l.who, msg: `${l.who} is speaking but hidden behind ${isFigMesh(b) || b.name || b.parent?.name || 'something'}` }); }
  }
  // head box on screen [x0, x1, y0, y1] (normalised, y down) and whether it is in front of the camera
  function headBox(cam, f) {
    const p = f.head.getWorldPosition(V(0, 0, 0)), r = 0.36 * f.s, R = V(1, 0, 0).applyQuaternion(cam.quaternion), U = V(0, 1, 0).applyQuaternion(cam.quaternion);
    const pr = v => v.clone().project(cam), l = pr(p.clone().addScaledVector(R, -r)), rr = pr(p.clone().addScaledVector(R, r)), tp = pr(p.clone().addScaledVector(U, r)), bt = pr(p.clone().addScaledVector(U, -r));
    const front = p.clone().sub(cam.position).dot(cam.getWorldDirection(V(0, 0, 0))) > 0.05;
    return { b: [(l.x + 1) / 2, (rr.x + 1) / 2, (1 - tp.y) / 2, (1 - bt.y) / 2], front, d: p.distanceTo(cam.position) };
  }
  // lens: nobody walks into the lens or fills the frame (hand-made pos/look shots are not checked by the camera search);
  // brand: the corner watermark never covers a face
  function checkLens(L, issues) {
    const cam = L.cam, wm = window.WM;
    for (const [n, f] of Object.entries(L.figs || {})) {
      if (!f.g.visible || f.qaSkip) continue;
      const hb = headBox(cam, f); if (!hb.front) continue;
      const vis = !(hb.b[1] < 0 || hb.b[0] > 1 || hb.b[3] < 0 || hb.b[2] > 1); if (!vis) continue;
      const hh = hb.b[3] - hb.b[2], tag = window.SHOTEXPLICIT ? ' (hand-made shot ' + window.SHOTNAME + ')' : '';
      if (hh > 0.45) issues.push({ k: 'lens', sev: 'fail', who: n, msg: `${n}'s head fills ${(hh * 100).toFixed(0)} % of the frame height${tag}: walking into the lens` });
      else if (hb.d < 0.9) issues.push({ k: 'lens', sev: 'fail', who: n, msg: `${n} is ${hb.d.toFixed(2)} m from the lens${tag}` });
      if (wm) { const ox = Math.min(hb.b[1], wm[1]) - Math.max(hb.b[0], wm[0]), oy = Math.min(hb.b[3], wm[3]) - Math.max(hb.b[2], wm[2]);
        if (ox > 0 && oy > 0 && ox * oy > 0.15 * (hb.b[1] - hb.b[0]) * hh) issues.push({ k: 'brand', sev: 'fail', who: n, msg: `the watermark covers ${n}'s face${tag}` }); }
    }
  }
  // in-world brand: every mesh tagged userData.brand (props.js, brand.js) is projected at the sampled time. It counts as
  // seen when it is in front of the lens, inside the frame, facing the camera (userData.brandN), not hidden behind
  // solids (3 of 5 rays clear; its own prop never hides it) and at least BRAND_MIN px in both directions on screen.
  const BRAND_MIN = 12;
  const rootOf = o => { for (let p = o; p; p = p.parent) if (p.userData.brandRoot) return p; return o; };
  function checkBrand(L, issues) {
    const cam = L.cam, Wp = window.FORMAT === 'short' ? 720 : 1280, Hp = window.FORMAT === 'short' ? 1280 : 720;
    const marks = []; L.scene.traverse(o => { if (o.isMesh && o.userData.brand && !hidden(o)) marks.push(o); });
    if (!marks.length) return;
    const sol = solids(L.scene), camDir = cam.getWorldDirection(V(0, 0, 0)), R = V(1, 0, 0).applyQuaternion(cam.quaternion), U = V(0, 1, 0).applyQuaternion(cam.quaternion);
    const heads = Object.entries(L.figs || {}).filter(([n, f]) => f.g.visible && !f.qaSkip).map(([n, f]) => [n, headBox(cam, f)]).filter(([n, h]) => h.front);
    let best = null;
    for (const m of marks) {
      m.updateMatrixWorld(true); const bb = new T.Box3().setFromObject(m); if (bb.isEmpty()) continue;
      const c = bb.getCenter(V(0, 0, 0)), toCam = cam.position.clone().sub(c), dist = toCam.length();
      if (c.clone().sub(cam.position).dot(camDir) < 0.05) continue;
      if (m.userData.brandN) { const n = V(...m.userData.brandN).transformDirection(m.matrixWorld); if (n.dot(toCam.clone().normalize()) < 0.2) continue; }
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (let i = 0; i < 8; i++) { const p = V(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).project(cam);
        x0 = Math.min(x0, (p.x + 1) / 2); x1 = Math.max(x1, (p.x + 1) / 2); y0 = Math.min(y0, (1 - p.y) / 2); y1 = Math.max(y1, (1 - p.y) / 2); }
      const cx0 = Math.max(0, x0), cx1 = Math.min(1, x1), cy0 = Math.max(0, y0), cy1 = Math.min(1, y1);
      if (cx1 <= cx0 || cy1 <= cy0 || (cx1 - cx0) < 0.6 * (x1 - x0) || (cy1 - cy0) < 0.6 * (y1 - y0)) continue;   // mostly off frame
      const px = Math.min((cx1 - cx0) * Wp, (cy1 - cy0) * Hp);
      // occlusion: rays to the centre and four points around it; the brand's own prop and transparent things never block
      const root = rootOf(m), own = new Set(); root.traverse(o => own.add(o));
      const ext = bb.getSize(V(0, 0, 0)).length() * 0.25; let clear = 0;
      for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const p = c.clone().addScaledVector(R, a * ext).addScaledVector(U, b * ext), d = p.clone().sub(cam.position), dd = d.length(); rc.set(cam.position, d.normalize()); rc.far = dd - 0.02;
        if (!rc.intersectObjects(sol, false).some(h => !own.has(h.object))) clear++;
      }
      if (clear < 3) continue;
      const name = root.name || m.name || 'brand piece';
      if (px >= BRAND_MIN && (!best || px > best.px)) best = { px, name };
      // a brand piece in front of a face, covering a good part of it
      for (const [n, hb] of heads) {
        if (dist > hb.d - 0.3) continue;
        const ox = Math.min(x1, hb.b[1]) - Math.max(x0, hb.b[0]), oy = Math.min(y1, hb.b[3]) - Math.max(y0, hb.b[2]);
        if (ox > 0 && oy > 0 && ox * oy > 0.25 * (hb.b[1] - hb.b[0]) * (hb.b[3] - hb.b[2])) issues.push({ k: 'brand', sev: 'warn', who: n, msg: `the ${name} covers ${n}'s face` });
      }
    }
    if (best) issues.push({ k: 'brandseen', sev: 'info', who: best.name, px: Math.round(best.px), msg: 'brand in view' });
  }
  function checkChip(t, issues) {
    const s = window.sceneAt(t); if (!s.chip) return;
    const el = document.getElementById('chip'), want = CAL[s.name];
    if (want !== undefined && want !== s.chip) issues.push({ k: 'chip', sev: 'fail', who: s.name, msg: `chip "${s.chip}" differs from the calendar "${want}"` });
    if (+el.style.opacity > 0.5 && el.textContent !== s.chip) issues.push({ k: 'chip', sev: 'fail', who: s.name, msg: `on-screen chip "${el.textContent}" differs from the story "${s.chip}"` });
  }
  window.QA = {
    at(t) {
      window.NORENDER = 1; const issues = [];
      window.renderAt(t); const L = window.LAST; if (!L) return issues; L.scene.updateMatrixWorld(true); tagFigs(L.figs);
      const stage = L.scene.userData.stage, S = figState(t);
      checkProps(L, S, issues); checkCam(L, issues); checkSpeaker(t, L, issues); checkChip(t, issues); checkLens(L, issues); checkBrand(L, issues);
      const s = window.sceneAt(t);
      if (t + 1 / 30 < s.end) { window.renderAt(t + 1 / 30); L.scene.updateMatrixWorld(true); const S2 = figState(t + 1 / 30); checkFigs(t, S, S2, stage, issues); }
      // a skate is a fail only when it lasts: a one-frame slip (a few cm at a step change) that has stopped by the next frame is a warning
      const sl = issues.filter(i => i.k === 'slide' && i.sev === 'fail');
      if (sl.length && t + 2 / 30 < s.end) { window.renderAt(t + 2 / 30); L.scene.updateMatrixWorld(true); const S3 = figState(t + 2 / 30);
        for (const i of sl) { const q = S3[i.who]?.feet[i._f]; if (q && Math.hypot(q.p.x - i._p.x, q.p.z - i._p.z) <= i._lim * 2) { i.sev = 'warn'; i.msg += ' (one frame)'; } } }
      for (const i of issues) { delete i._f; delete i._lim; delete i._p; }
      return issues;
    },
    // walk speeds of every scripted walk in the film (actors are built when the set modules load)
    speeds() {
      const out = [];
      for (const [k, s] of Object.entries(window.SPEEDS || {})) if (s.m > 0.8 && !s.run && (s.v < 0.6 || s.v > 2.2)) out.push({ k: 'speed', sev: 'fail', who: k, t: s.t0, msg: `walk ${k} at ${s.v.toFixed(2)} m/s over ${s.m.toFixed(1)} m (allowed 0.6 to 2.2)` });
      return out;
    },
  };
})();
