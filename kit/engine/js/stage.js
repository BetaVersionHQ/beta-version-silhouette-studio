// Stage toolkit shared by every set: obstacle-aware walking, actor blocking scripts, seats, talk/look acting,
// tracked props (for the QA float/mix checks) and an automatic camera that refuses blocked or cut shots.
import { ASPECT, PORTRAIT, WM, THREE, V, clamp, smooth, lerp, win, SC, TL, linesOf, lineEnd, env, talkW, applyPose, blendPose, standPose, seatPose, walkPose,
  plantFeet, liftFeet, ikLeg, ik, ikWorld, handWorld, blink, rimMaterial, makeFigure, yawQ, roundPath, STAND_HIP } from './core.js';
import { walkArms, hang, ikW, lerpAngle, yawTo } from './act.js';

export const S0 = n => SC[n].start, S1 = n => SC[n].end;
export const angDiff = (a, b) => ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;

// ---------------------------------------------------------------- stage
export class Stage {
  constructor(name, { bounds = [-12, 12, -12, 12], fov = 36 } = {}) {
    this.name = name; this.scene = new THREE.Scene(); this.cam = new THREE.PerspectiveCamera(fov, ASPECT, 0.05, 400);
    this.bounds = bounds; this.obs = []; this.seats = {}; this.figs = {}; this.actors = {}; this.props = []; this.camCache = {};
    this.scene.userData.stage = this;
  }
  // footprints that walkers must route around (rect: centre, size, rotation; circle: centre, radius)
  block(x, z, w, d, ry = 0, tag = '') { this.obs.push({ k: 'r', x, z, w, d, ry, tag }); return this; }
  blockC(x, z, r, tag = '') { this.obs.push({ k: 'c', x, z, r, tag }); return this; }
  // a seat: hips at (x, z) on a surface of height `top`, facing yaw; standing spot is `front` metres ahead
  seat(name, x, z, top, yaw, front = 0.42) { this.seats[name] = { x, z, top, yaw, front, fx: x + Math.sin(yaw) * front, fz: z + Math.cos(yaw) * front }; return this.seats[name]; }
  fig(name, rim = 0xffe6cc, opts = {}, str = 1.0) {
    const m = rimMaterial({ rim, power: 5.5, strength: str, lightStr: 0 }); const f = makeFigure(m, opts); f.m = m; f.name = name;
    this.scene.add(f.g); this.figs[name] = f; return f;
  }
  // movable props are tracked so QA can check they are held or resting on something (never floating or inside things)
  track(obj, name) { obj.name = obj.name || name; obj.userData.tracked = true; obj.userData.trackName = name; this.props.push(obj); return obj; }
  clearAt(x, z, clr = 0.32) {
    const [x0, x1, z0, z1] = this.bounds; if (x < x0 || x > x1 || z < z0 || z > z1) return false;
    if (this.walkable && !this.walkable(x, z, clr)) return false;
    for (const o of this.obs) {
      if (o.k === 'c') { if (Math.hypot(x - o.x, z - o.z) < o.r + clr) return false; continue; }
      const c = Math.cos(-o.ry), s = Math.sin(-o.ry), dx = x - o.x, dz = z - o.z, lx = dx * c - dz * s, lz = dx * s + dz * c;
      const qx = Math.max(Math.abs(lx) - o.w / 2, 0), qz = Math.max(Math.abs(lz) - o.d / 2, 0);
      if (Math.hypot(qx, qz) < clr) return false;
    }
    return true;
  }
  // A* on a 0.1 m grid, then string-pulled and rounded. Throws if no route exists (a staging bug to fix, not to hide).
  path(a, b, clr = 0.32) {
    const G = 0.1, [x0, x1, z0, z1] = this.bounds, nx = Math.ceil((x1 - x0) / G) + 1, nz = Math.ceil((z1 - z0) / G) + 1;
    const id = (i, j) => j * nx + i, cx = i => x0 + i * G, cz = j => z0 + j * G;
    const ck = clr + ':' + this.obs.length; this._grid = this._grid || {};
    let ok = this._grid[ck]; if (!ok) { ok = new Uint8Array(nx * nz); for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) ok[id(i, j)] = this.clearAt(cx(i), cz(j), clr) ? 1 : 0; this._grid[ck] = ok; }
    const snap = p => { let bi = Math.round((p[0] - x0) / G), bj = Math.round((p[1] - z0) / G), best = null, bd = 1e9;
      for (let r = 0; r < 8 && !best; r++) for (let j = bj - r; j <= bj + r; j++) for (let i = bi - r; i <= bi + r; i++) { if (i < 0 || j < 0 || i >= nx || j >= nz || !ok[id(i, j)]) continue; const d = Math.hypot(cx(i) - p[0], cz(j) - p[1]); if (d < bd) { bd = d; best = [i, j]; } }
      return best; };
    const A = snap(a), B = snap(b); if (!A || !B) throw new Error(`${this.name}: no clear cell near ${a} or ${b}`);
    const g = new Float32Array(nx * nz).fill(1e9), came = new Int32Array(nx * nz).fill(-1), open = [[0, id(...A)]]; g[id(...A)] = 0;
    const goal = id(...B), h = k => Math.hypot(k % nx - B[0], Math.floor(k / nx) - B[1]);
    const closed = new Uint8Array(nx * nz);
    // binary min-heap on f = g + h
    const push = e => { open.push(e); let i = open.length - 1; while (i > 0) { const pa = (i - 1) >> 1; if (open[pa][0] <= open[i][0]) break; [open[pa], open[i]] = [open[i], open[pa]]; i = pa; } };
    const popMin = () => { const top = open[0], last = open.pop(); if (open.length) { open[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < open.length && open[l][0] < open[m][0]) m = l; if (r < open.length && open[r][0] < open[m][0]) m = r; if (m === i) break; [open[m], open[i]] = [open[i], open[m]]; i = m; } } return top; };
    while (open.length) {
      const [, k] = popMin(); if (closed[k]) continue; closed[k] = 1; if (k === goal) break;
      const i = k % nx, j = Math.floor(k / nx);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
        const kk = id(ii, jj); if (!ok[kk] || closed[kk]) continue; if (di && dj && (!ok[id(i + di, j)] || !ok[id(i, j + dj)])) continue;
        const ng = g[k] + Math.hypot(di, dj); if (ng < g[kk]) { g[kk] = ng; came[kk] = k; push([ng + h(kk), kk]); } }
    }
    if (came[goal] < 0 && goal !== id(...A)) throw new Error(`${this.name}: no route from ${a} to ${b}`);
    let cells = []; for (let k = goal; k >= 0; k = came[k]) { cells.push([cx(k % nx), cz(Math.floor(k / nx))]); if (k === id(...A)) break; }
    cells.reverse();
    const los = (p, q) => { const n = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 0.05); for (let s = 0; s <= n; s++) { const u = s / n; if (!this.clearAt(lerp(p[0], q[0], u), lerp(p[1], q[1], u), clr)) return false; } return true; };
    const pts = [a.slice()]; let cur = a;
    const full = cells.concat([b]);
    for (let i = 1; i < full.length; i++) if (!los(cur, full[i])) { pts.push(full[i - 1]); cur = full[i - 1]; }
    pts.push(b.slice());
    return pts.length > 2 ? roundPath(pts, 0.45, 6) : pts;
  }
}
export const pathLen = pts => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; };

// ---------------------------------------------------------------- poses
export function kneelPose(f, x, z, yaw, head = [0.15, 0, 0]) {
  // right knee on the ground, left foot planted forward
  return { hip: V(x, 0.62 * f.s, z), quat: yawQ(yaw), tilt: 0.05, thigh: [-1.45, 0.25], knee: [1.5, 1.85], head, seated: true };
}
export function crouchPose(f, x, z, yaw, head = [0.3, 0, 0]) { return { hip: V(x, 0.5 * f.s, z), quat: yawQ(yaw), tilt: 0.45, thigh: [-1.9, -1.9], knee: [2.2, 2.2], head, seated: true }; }
export function runPose(f, x, z, yaw, dist, k = 1, head = [0.05, 0, 0]) {
  // a jog with the stance foot locked: during stance (half the cycle) the foot moves back exactly as fast as the body moves
  // forward, so it never skates; the other half is the swing with the knee folded up
  const Leff = 0.86 * f.s, A = Leff * Math.sin(0.6), stride = 2 * A, p = dist / stride * Math.PI;
  const wrap = q => ((q + Math.PI / 2) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI / 2;
  const fx = ph => { const q = wrap(p + ph); if (q < Math.PI / 2) return A * q / (Math.PI / 2); const u = (q - Math.PI / 2) / Math.PI;   // swing: Hermite with the stance slope at both ends, so the foot lands at rest
    return A * (2 * u ** 3 - 3 * u * u + 1) + 2 * A * (u ** 3 - 2 * u * u + u) - A * (-2 * u ** 3 + 3 * u * u) + 2 * A * (u ** 3 - u * u); };
  const leg = ph => Math.asin(clamp(fx(ph) / Leff, -0.9, 0.9)), knee = ph => { const q = wrap(p + ph); return 0.3 * k + (q < Math.PI / 2 ? 0 : Math.sin(q - Math.PI / 2) * 1.2 * k); };
  return { pose: { hip: V(x, STAND_HIP * f.s - 0.05 * k + Math.abs(Math.sin(p)) * 0.07 * k, z), quat: yawQ(yaw), tilt: 0.04 + 0.14 * k, thigh: [leg(0), leg(Math.PI)], knee: [knee(0), knee(Math.PI)], head, roll: Math.sin(p) * 0.03 * k }, phase: p };
}
export function runArms(f, ph, k = 1) {
  for (const [side, s] of [['L', -1], ['R', 1]]) {
    const sw = Math.sin(ph + (side === 'L' ? 0 : Math.PI)) * k;
    ik(side === 'L' ? f.armL : f.armR, V(s * 0.27, lerp(0.92, 1.3, k) + Math.max(0, sw) * 0.14 * k, lerp(0.05, 0.16, k) + sw * 0.26 * k), V(s * 0.3, -0.4, -1));
  }
}

// ---------------------------------------------------------------- actors
// script commands (times are absolute seconds; walks get their duration from distance / speed):
//   ['walk', t0, [x,z] or [[x,z],...], {speed, face, run, direct}]   ['face', t0, yaw | 'actor' | [x,z]]
//   ['sit', t0, seat]   ['rise', t0]   ['kneel', t0]   ['unkneel', t0]   ['hide', t0]   ['show', t0, {x,z,yaw}]   ['place', t0, {x,z,yaw}]
export class Actor {
  constructor(stage, name, f, start, script = []) {
    this.st = stage; this.name = name; this.f = f; this.look = null; this.lookK = 1; this.mood = 0; this.slump = 0; stage.actors[name] = this;
    this.segs = []; let x = start.x, z = start.z, yaw = start.yaw ?? 0, mode = start.seat ? 'sit' : 'stand', seat = start.seat ? stage.seats[start.seat] : null, vis = start.hidden ? false : true;
    if (seat) { x = seat.x; z = seat.z; yaw = seat.yaw; }
    this.init = { x, z, yaw, mode, seat, vis };
    for (const c of [...script].sort((a, b) => a[1] - b[1])) {
      if (this.segs?.length && c[0] !== 'hide' && c[0] !== 'show' && c[1] < this.segs[this.segs.length - 1].t1 - 0.05) (window.SCRIPT_WARN ||= []).push(`${name}: '${c[0]}' at ${c[1].toFixed(2)} starts before '${this.segs[this.segs.length - 1].k}' ends at ${this.segs[this.segs.length - 1].t1.toFixed(2)}`);
      const [k, t0, arg, o = {}] = c, s = { k, t0, from: { x, z, yaw, mode, seat, vis } };
      if (k === 'walk') {
        const dest = Array.isArray(arg[0]) ? arg : [arg]; let pts = [[x, z]];
        for (const d of dest) {
          const seg = o.direct ? [pts[pts.length - 1], d] : stage.path(pts[pts.length - 1], d);
          // round the corner where two waypoint legs join (a sharp corner pivots the planted foot and it skates)
          if (pts.length > 1 && !o.sharp && seg.length > 1) { const j = pts.pop(), a = pts[pts.length - 1], c = seg[1]; pts = pts.concat(roundPath([a, j, c], 0.35, 6).slice(1, -1)); }
          pts = pts.concat(seg.slice(1));
        }
        const L = pathLen(pts), sp = o.by ? L / Math.max(0.5, o.by - t0) : o.speed || (o.run ? 3.2 : 1.2);  // by: arrive at this time
        s.pts = pts; s.t1 = t0 + Math.max(0.8, L / sp); s.L = L; s.run = !!o.run;
        // a big first turn is taken on the spot before stepping off (turning while a foot is planted makes it skate)
        { const d0 = Math.abs(angDiff(yaw, yawTo(pts[0][0], pts[0][1], pts[Math.min(2, pts.length - 1)][0], pts[Math.min(2, pts.length - 1)][1]))); if (d0 > 0.6 && !o.noTurn) { s.turn = 0.35 + 0.45 * d0 / Math.PI; s.dir0 = yawTo(pts[0][0], pts[0][1], pts[Math.min(2, pts.length - 1)][0], pts[Math.min(2, pts.length - 1)][1]); s.t1 += o.by ? 0 : s.turn; } }
        const n = pts.length; x = pts[n - 1][0]; z = pts[n - 1][1]; yaw = yawTo(pts[n - 2][0], pts[n - 2][1], x, z);
        if (o.face !== undefined) s.face = o.face; mode = 'stand';
        if (window.SPEEDS) window.SPEEDS[`${stage.name}/${name}/${t0.toFixed(2)}`] = { t0, t1: s.t1, m: L, v: L / (s.t1 - t0 - (s.turn || 0)), run: s.run };
      } else if (k === 'face') { s.t1 = t0 + (o.dur || 0.7); s.face = arg; }
      else if (k === 'sit') { seat = stage.seats[arg]; if (!seat) throw new Error('no seat ' + arg); s.seat = seat; s.t1 = t0 + 1.1; x = seat.x; z = seat.z; yaw = seat.yaw; mode = 'sit'; }
      else if (k === 'rise') { s.seat = seat; s.t1 = t0 + 1.1; x = seat.fx; z = seat.fz; yaw = seat.yaw; mode = 'stand'; seat = null; }
      else if (k === 'kneel') { s.t1 = t0 + 0.9; mode = 'kneel'; }
      else if (k === 'unkneel') { s.t1 = t0 + 0.9; mode = 'stand'; }
      else if (k === 'hide') { s.t1 = t0; vis = false; }
      else if (k === 'show' || k === 'place') { s.t1 = t0; vis = k === 'show' ? true : vis; x = arg.x; z = arg.z; yaw = arg.yaw ?? yaw; mode = arg.seat ? 'sit' : 'stand'; seat = arg.seat ? stage.seats[arg.seat] : null; if (seat) { x = seat.x; z = seat.z; yaw = seat.yaw; } }
      s.to = { x, z, yaw, mode, seat, vis }; this.segs.push(s);
    }
  }
  // the end time of the n-th command of a kind (for chaining marks: a.end('walk', 0))
  end(kind, n = 0) { return this.segs.filter(s => s.k === kind)[n].t1; }
  faceYaw(spec, x, z, fallback) {
    if (spec === undefined || spec === null) return fallback;
    if (typeof spec === 'number') return spec;
    if (typeof spec === 'string') { const o = this.st.actors[spec]; const p = o.posAt(this._t); return yawTo(x, z, p.x, p.z); }
    return yawTo(x, z, spec[0], spec[1]);
  }
  posAt(t) { // cheap position (no pose) used for facing other actors
    let st = this.init; for (const s of this.segs) { if (t < s.t0) break; if (s.k === 'walk' && t < s.t1) { const s0 = s.t0 + (s.turn || 0), u = clamp((t - s0) / (s.t1 - s0)); const w = walkPose(this.f, s.pts, u); return { x: w.x, z: w.z }; } st = s.to; }
    return { x: st.x, z: st.z };
  }
  // full state at t: {mode, x, z, yaw, walking, phase, amp, vis, k (transition progress)}
  state(t) {
    this._t = t; let cur = this.init, active = null, lastFace = null;
    for (const s of this.segs) { if (t < s.t0) break; if (t < s.t1) { active = s; break; } cur = s.to; if (s.k === 'face' || s.k === 'walk') lastFace = s; }
    const out = { ...cur, walking: false, k: 1 };
    // persistent facing after a 'face' command or a walk with face (re-evaluated so it can track a moving actor)
    if (!active && lastFace && lastFace.face !== undefined && out.mode === 'stand') {
      const fy = this.faceYaw(lastFace.face, out.x, out.z, out.yaw);
      // after a walk, turn to the face target over a moment instead of snapping round
      if (lastFace.k === 'walk') { const turn = 0.35 + 0.45 * Math.abs(angDiff(lastFace.to.yaw, fy)) / Math.PI; out.yaw = lerpAngle(lastFace.to.yaw, fy, smooth(lastFace.t1, lastFace.t1 + turn, t)); }
      else out.yaw = fy;
    }
    if (!active) return out;
    if (active.k === 'walk' && active.turn && t < active.t0 + active.turn) { out.yaw = lerpAngle(active.from.yaw, active.dir0, smooth(active.t0, active.t0 + active.turn, t)); out.k = 0; out.active = 'turn'; return out; }
    const s = active, s0 = s.t0 + (s.k === 'walk' && s.turn ? s.turn : 0), u = clamp((t - s0) / Math.max(1e-3, s.t1 - s0)); out.k = u; out.active = s.k;
    if (s.k === 'walk') {
      const ue = lerp(u, u * u * (3 - 2 * u), s.run ? 0.3 : 0.6), w0 = walkPose(this.f, s.pts, ue), L = s.L;
      const a = walkPose(this.f, s.pts, clamp(ue - 0.3 / L)), b = walkPose(this.f, s.pts, clamp(ue + 0.3 / L));
      const yaw = (b.x - a.x) ** 2 + (b.z - a.z) ** 2 > 1e-6 ? Math.atan2(b.x - a.x, b.z - a.z) : w0.yaw;
      Object.assign(out, { x: w0.x, z: w0.z, yaw: lerpAngle(s.turn ? s.dir0 : s.from.yaw, yaw, smooth(0, Math.max(0.12, Math.min(0.5, 0.7 / Math.max(0.1, s.t1 - s0))), u)), walking: true, run: s.run, ue, L, amp: clamp(Math.min(ue * L, (1 - ue) * L) / 0.3), mode: 'stand', vis: s.from.vis });
    } else if (s.k === 'face') {
      out.yaw = lerpAngle(s.from.yaw, this.faceYaw(s.face, out.x, out.z, out.yaw), smooth(0, 1, u));
    } else if (s.k === 'sit' || s.k === 'rise' || s.k === 'kneel' || s.k === 'unkneel') { out.trans = s.k; out.seat = s.seat || out.seat; out.from = s.from; }
    return out;
  }
  // walking over steps: the hip rides a smoothed ramp of the treads (knees a little bent), and each foot is put by leg IK on
  // the tread under it; a swinging foot is lifted clear of the tread edges around it. Returns false on level ground.
  // running feet by leg IK: the stance foot is pinned to the ground exactly where it landed (it moves back as fast as the
  // body moves forward), the swing foot follows a Hermite arc with the stance slope at both ends and a lift in between
  runFeet(f, floorFn, yaw, p, k) {
    plantFeet(f, floorFn);
    const A = 0.86 * f.s * Math.sin(0.6), fx = Math.sin(yaw), fz = Math.cos(yaw), hp = f.g.position, sx = Math.cos(yaw), sz = -Math.sin(yaw);
    const wrap = q => ((q + Math.PI / 2) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI / 2;
    const tg = [[f.legL, 0, -1], [f.legR, Math.PI, 1]].map(([l, ph, side]) => { const q = wrap(p + ph); let off, lift = 0;
      if (q < Math.PI / 2) off = -A * q / (Math.PI / 2);
      else { const u = (q - Math.PI / 2) / Math.PI; off = -(A * (2 * u ** 3 - 3 * u * u + 1) + 2 * A * (u ** 3 - 2 * u * u + u) - A * (-2 * u ** 3 + 3 * u * u) + 2 * A * (u ** 3 - u * u)); lift = 0.24 * k * f.s * Math.sin(Math.PI * u) ** 0.7; }
      const w = 0.13 * f.s * side, x = hp.x + fx * off + sx * w, z = hp.z + fz * off + sz * w; return V(x, floorFn(x, z) + 0.055 * f.s + lift, z); });
    // keep the hip low enough that the leg reaching furthest still lands it (the knees take the rest)
    for (let i = 0; i < 4; i++) {
      [f.legL, f.legR].forEach((l, j) => ikLeg(l, tg[j])); f.g.updateMatrixWorld(true);
      const short = Math.max(...[f.legL, f.legR].map((l, j) => l.foot.localToWorld(V(0, 0, 0)).y - tg[j].y));
      if (short < 0.003) break; f.g.position.y -= short + 0.004; f.g.updateMatrixWorld(true);
    }
  }
  // walking: the stance foot is planted (it moves back at the hip's speed, so it never skates) and the swing foot is kept
  // clear of the floor with a small arc. Planting on whichever foot is lowest instead let a short swing touch down early and drag.
  walkFeet(f, floorFn, sw) {
    const legs = [f.legL, f.legR], si = sw[0] < 0 ? 0 : sw[1] < 0 ? 1 : -1;
    if (si < 0) return plantFeet(f, floorFn);
    f.g.updateMatrixWorld(true);
    const q = legs[si].foot.localToWorld(V(0, 0, 0)); f.g.position.y -= q.y - floorFn(q.x, q.z) - 0.055 * f.s; f.g.updateMatrixWorld(true);
    const j = 1 - si, q2 = legs[j].foot.localToWorld(V(0, 0, 0)), minY = floorFn(q2.x, q2.z) + 0.055 * f.s + 0.03 * f.s * Math.sin(Math.PI * clamp(sw[j]));
    if (q2.y < minY) { ikLeg(legs[j], V(q2.x, minY, q2.z)); f.g.updateMatrixWorld(true); }
  }
  stairWalk(f, p, floorFn, yaw) {
    const fx = Math.sin(yaw), fz = Math.cos(yaw), hx = p.hip.x, hz = p.hip.z, f0 = floorFn(hx, hz);
    let near = 0; const H = [];
    for (let j = 0; j <= 48; j++) { const o = -0.6 + j * 0.025, h = floorFn(hx + fx * o, hz + fz * o); H.push(h); if (Math.abs(h - f0) > 0.03) near = Math.max(near, 1 - Math.abs(o) / 0.6); }
    if (near === 0) return false;
    // the hip rides the lowest of the smoothed tread heights around it, so the leg that has to reach furthest down can
    const avg = c => { let a = 0; for (let j = c - 12; j <= c + 12; j++) a += H[j]; return a / 25; }, ramp = Math.min(...[14, 19, 24, 29, 34].map(avg)), n = 1;
    plantFeet(f, f0);
    const feet = [f.legL, f.legR].map(l => l.foot.localToWorld(V(0, 0, 0)));
    f.g.position.y += ramp / n - f0 - 0.05 * f.s * near; f.g.updateMatrixWorld(true);
    const tg = [f.legL, f.legR].map((l, i) => { const q = feet[i], lift = q.y - f0 - 0.055 * f.s, fl = floorFn(q.x, q.z);
      let top = fl; for (const o of [-0.14, -0.07, 0.07, 0.14]) top = Math.max(top, floorFn(q.x + fx * o, q.z + fz * o));
      let rest = fl; for (const o of [-0.06, 0.06]) rest = Math.max(rest, floorFn(q.x + fx * o, q.z + fz * o));   // a heel on a tread edge rests on the higher tread
      const kk = lift > 0.004 ? clamp(lift / 0.03) : 0; return V(q.x, rest + (top - rest) * kk + 0.055 * f.s + lift, q.z); });
    // a foot the leg cannot reach: lower the body until it does (the knees take it)
    for (let k = 0; k < 3; k++) {
      [f.legL, f.legR].forEach((l, i) => ikLeg(l, tg[i])); f.g.updateMatrixWorld(true);
      const short = Math.max(...[f.legL, f.legR].map((l, i) => l.foot.localToWorld(V(0, 0, 0)).y - tg[i].y));
      if (short < 0.002) break; f.g.position.y -= short + 0.004; f.g.updateMatrixWorld(true);
    }
    return true;
  }
  update(t, { head = null } = {}) {
    const f = this.f, st = this.state(t); this.cur = st; f.g.visible = !!st.vis; if (!st.vis) return st;
    const Ls = TL.lines, who = this.name;
    const tk = this.talking(t); const hd = head || [0.06, 0, 0];
    const breath = Math.sin(t * 1.6 + this.name.length) * 0.006;
    let p;
    if (st.walking) {
      if (st.run) { const r = runPose(f, st.x, st.z, st.yaw, st.ue * st.L, clamp(st.amp * 1.2), hd.slice()); p = r.pose; this._phase = r.phase; }
      else { const w = walkPose(f, this.segs.find(s => s.k === 'walk' && t >= s.t0 && t < s.t1).pts, st.ue, { yaw: st.yaw, head: hd.slice() }); p = w.pose; this._phase = w.phase; this._stance = w.stance; }
    } else if (st.trans === 'sit' || st.trans === 'rise') {
      const seat = st.seat, sp = seatPose(f, seat.x, seat.z, seat.top, seat.yaw, 0.08 + this.slump), up = standPose(f, seat.fx, seat.fz, seat.yaw);
      const k = st.trans === 'sit' ? st.k : 1 - st.k;
      p = blendPose(up, sp, smooth(0, 1, k)); p.tilt += Math.sin(k * Math.PI) * 0.45; p.seated = k > 0.45; p.head = hd.slice();
    } else if (st.trans === 'kneel' || st.trans === 'unkneel') {
      const k = st.trans === 'kneel' ? st.k : 1 - st.k;
      p = blendPose(standPose(f, st.x, st.z, st.yaw), kneelPose(f, st.x, st.z, st.yaw), smooth(0, 1, k)); p.seated = k > 0.5; p.head = hd.slice();
    } else if (st.mode === 'sit') { p = seatPose(f, st.seat.x, st.seat.z, st.seat.top, st.seat.yaw, 0.08 + this.slump); p.seated = true; p.head = hd.slice(); }
    else if (st.mode === 'kneel') { p = kneelPose(f, st.x, st.z, st.yaw); p.head = hd.slice(); }
    else { p = standPose(f, st.x, st.z, st.yaw, hd.slice()); p.tilt = 0.02 + this.slump * 0.6; p.hip.y += breath; }
    // head: talk bob + look at a target (yaw clamped so the neck never twists past the shoulder)
    p.head[0] += tk * 0.6 * Math.sin(t * 5.3) + this.mood * 0.12; p.head[1] += tk * 0.35 * Math.sin(t * 3.1 + 1);
    if (this.look && !st.walking) {
      const tgt = typeof this.look === 'string' ? this.st.figs[this.look]?.head.getWorldPosition(V(0, 0, 0)) || this.st.actors[this.look]?.f.head.getWorldPosition(V(0, 0, 0)) : this.look;
      if (tgt) { const bodyYaw = st.mode === 'sit' && st.seat ? st.seat.yaw : st.yaw; const want = angDiff(bodyYaw, yawTo(st.x, st.z, tgt.x, tgt.z));
        p.head[1] += clamp(want, -0.85, 0.85) * this.lookK; const dy = tgt.y - (p.hip.y + 1.0 * f.s), dh = Math.hypot(tgt.x - st.x, tgt.z - st.z); p.head[0] += clamp(-Math.atan2(dy, dh) * 0.6, -0.35, 0.45) * this.lookK; }
    }
    if (this.adjust) this.adjust(p, t, st);
    f.posedDown = !!(p.inBed || p.seated);   // lying or seated by an adjust hook: QA skips the standing-feet checks
    // floorAt(x,z): ground height under the actor (steps, terraces, stages); feet are planted on it
    // seat tops are absolute heights, so a seated hip is not raised by the floor (only the standing part of a sit/rise blend is)
    const floorFn = (x, z) => this.floorAt ? this.floorAt(x, z) : this.st.floorY ? this.st.floorY(x, z) : 0;
    const fl = floorFn(p.hip.x, p.hip.z);
    const seatK = st.trans === 'sit' ? smooth(0, 1, st.k) : st.trans === 'rise' ? smooth(0, 1, 1 - st.k) : st.mode === 'sit' && !st.trans ? 1 : 0;
    p.hip.y += fl * (1 - seatK);
    applyPose(f, p);
    if (p.seated || p.inBed) { f.g.updateMatrixWorld(true); const ff = Math.max(...[f.legL, f.legR].map(l => { const q = l.foot.localToWorld(V(0, 0, 0)); return floorFn(q.x, q.z); })); liftFeet(f, seatK > 0.5 ? ff : fl); }
    else if (st.walking && st.run) this.runFeet(f, floorFn, st.yaw, this._phase, clamp(st.amp * 1.2));
    else if (!(st.walking && this.stairWalk(f, p, floorFn, st.yaw))) { if (st.walking && this._stance) this.walkFeet(f, floorFn, this._stance); else plantFeet(f, floorFn); }
    // arms: walking swing, otherwise relaxed with small talk gestures
    if (st.walking) { if (st.run) runArms(f, this._phase, clamp(st.amp * 1.2)); else walkArms(f, this._phase, st.amp); }
    else if (st.mode === 'sit' || st.trans === 'sit' || st.trans === 'rise') { const g = tk * 2.2; ik(f.armL, V(-0.2, 1.02, 0.32), V(-0.5, -0.4, -0.6)); ik(f.armR, V(0.22 + g * 0.05, 1.04 + g * 0.18, 0.34 + g * 0.08), V(0.5, -0.4, -0.6)); }
    else if (st.mode === 'kneel' || st.trans) { hang(f, 'L', 0.3); hang(f, 'R', 0.3); }
    else { const g = clamp(tk * 3.0), w = Math.sin(t * 1.7 + this.name.length) * 0.5 + 0.5;
      ik(f.armR, V(0.36 - g * 0.06, 0.92 + g * (0.28 + w * 0.12), 0.05 + g * 0.3), V(0.5, -0.4, -0.7)); ik(f.armL, V(-0.36 + g * 0.03 * w, 0.92 + g * 0.08 * w, 0.05 + g * 0.1 * w), V(-0.5, -0.4, -0.7)); }
    blink(f, t, this.name.length * 0.37, this.eyes ?? 1);
    return st;
  }
  talking(t) { return TL.lines.reduce((a, l) => a + (l.who === this.name && l.voice === l.who ? talkW(l, t) * env(this.name, t) * 0.05 : 0), 0); }
  headPos() { return this.f.head.getWorldPosition(V(0, 0, 0)); }
}

// ---------------------------------------------------------------- automatic camera
// Searches positions around the target head(s) and refuses shots where the view is blocked by geometry, where the camera
// sits inside a prop, where any visible head is cut by the frame edge or where a nearer head covers the speaker.
// Results are cached per key; callers pose the scene at the shot's start before the first call so every render chunk agrees.
const RC = new THREE.Raycaster();
function solidMeshes(stage) {
  const figObjs = new Set(); for (const f of Object.values(stage.figs)) f.g.traverse(o => figObjs.add(o));
  const out = []; stage.scene.updateMatrixWorld(true);
  stage.scene.traverse(o => { if (!o.isMesh || figObjs.has(o) || o.userData.camSkip) return; let v = true; for (let p = o; p; p = p.parent) if (!p.visible) v = false; if (!v) return;
    const m = o.material; if (!m || (m.transparent && m.opacity < 0.6 && !o.userData.camBlock) || o.isSprite) return; out.push(o); });
  return out;
}
export function frameInfo(cam, p, r) {
  const right = V(1, 0, 0).applyQuaternion(cam.quaternion), up = V(0, 1, 0).applyQuaternion(cam.quaternion);
  const pr = v => v.clone().project(cam);
  const l = pr(p.clone().addScaledVector(right, -r)), rr = pr(p.clone().addScaledVector(right, r)), tp = pr(p.clone().addScaledVector(up, r)), bt = pr(p.clone().addScaledVector(up, -r));
  const front = p.clone().sub(cam.position).dot(cam.getWorldDirection(V(0, 0, 0))) > 0;
  return { b: [(l.x + 1) / 2, (rr.x + 1) / 2, (1 - tp.y) / 2, (1 - bt.y) / 2], front, d: p.distanceTo(cam.position) };
}
// does a head box [x0, x1, y0, y1] (normalised, y down) touch the corner watermark?
export const underMark = b => b[1] > WM[0] - 0.01 && b[0] < WM[1] && b[3] > WM[2] && b[2] < WM[3] + 0.01;
// a hand-made fov written for 16:9 opened up for the tall 9:16 frame (shows ~1.5x the height, ~half the width)
export const portraitFov = f => Math.min(75, 2 * Math.atan(Math.tan(f * Math.PI / 360) * 1.5) * 180 / Math.PI);
export function autoCam(stage, key, spec) {
  if (stage.camCache[key]) return stage.camCache[key];
  const cam = stage.cam, mesh = solidMeshes(stage);
  const figs = Object.values(stage.figs).filter(f => f.g.visible);
  const head = f => f.head.getWorldPosition(V(0, 0, 0)), R = 0.36;
  const T = spec.who.map(n => stage.figs[n] || stage.actors[n].f), TH = T.map(head);
  const fw = f => { const q = f.body.getWorldQuaternion(new THREE.Quaternion()); const v = V(0, 0, 1).applyQuaternion(q); v.y = 0; return v.normalize(); };
  const centre = TH.reduce((a, b) => a.add(b), V(0, 0, 0)).multiplyScalar(1 / TH.length);
  const span = TH.length > 1 ? Math.max(...TH.map(h => h.distanceTo(centre))) : 0;
  const face = T.map(fw).reduce((a, b) => a.add(b), V(0, 0, 0)); if (face.lengthSq() < 1e-4) face.set(0, 0, 1); face.normalize();
  const ang0 = Math.atan2(face.x, face.z), res = [];
  const AZ = spec.az ?? 80, dists = spec.dists || (TH.length > 1 ? [3.4, 4.0, 4.8, 5.8, 7.0] : [2.9, 3.3, 3.8, 4.5]), hs = spec.hs || [-0.1, 0.12, 0.35];
  const side = spec.side ?? stage.camCache['side:' + spec.scene];
  const save = { p: cam.position.clone(), q: cam.quaternion.clone(), fov: cam.fov };
  for (let az = -AZ; az <= AZ; az += 8) for (const dist of dists) for (const dh of hs) {
    const a = ang0 + az * Math.PI / 180, P = V(centre.x + Math.sin(a) * dist, centre.y + dh, centre.z + Math.cos(a) * dist);
    if (P.y < 0.5) continue;
    const look = centre.clone().add(V(0, TH.length > 1 ? -0.35 : -0.42, 0));
    // metres of world to fit: landscape fits the people vertically; a tall 9:16 frame fits a single speaker head to knees
    // (head ~20 % of the height) and fits a group across its narrow width
    const want = TH.length > 1 ? (span * 2 + 1.6) : (spec.want || (PORTRAIT ? 2.3 : 1.4));
    const raw = PORTRAIT && TH.length > 1 ? 2 * Math.atan((span * 2 + 1.3) / 2 / dist / ASPECT) * 180 / Math.PI
      : 2 * Math.atan(want / 2 / dist) * 180 / Math.PI * (TH.length > 1 ? 0.75 : 1.6);
    const fov = clamp(raw, spec.minFov || 22, spec.maxFov || (PORTRAIT ? 66 : 46));
    cam.position.copy(P); cam.fov = fov; cam.updateProjectionMatrix(); cam.lookAt(look); cam.updateMatrixWorld(true);
    let bad = 0; const notes = [];
    // is the camera inside or touching something?
    for (const o of mesh) { const bb = (o.geometry.boundingBox || (o.geometry.computeBoundingBox(), o.geometry.boundingBox)); const pl = P.clone().applyMatrix4(new THREE.Matrix4().copy(o.matrixWorld).invert()); const ex = bb.clone().expandByScalar(0.12 / Math.max(1e-3, o.getWorldScale(V(0, 0, 0)).x)); if (ex.containsPoint(pl) && !o.userData.shell) { bad += 100; notes.push('inside ' + (o.name || 'mesh')); break; } }
    for (let i = 0; i < T.length; i++) {
      const fi = frameInfo(cam, TH[i], R);
      if (fi.b[2] < 0.05 || fi.b[0] < 0.03 || fi.b[1] > 0.97 || fi.b[3] > 0.95) { bad += 40; notes.push('cut ' + spec.who[i]); }
      const hh = fi.b[3] - fi.b[2]; if (hh > (spec.maxH || (PORTRAIT ? 0.26 : 0.34))) { bad += 30; notes.push('big'); } if (hh < (spec.minH || (TH.length > 1 ? 0.07 : PORTRAIT ? 0.1 : 0.13))) { bad += 8; notes.push('small'); }
      if (underMark(fi.b)) { bad += 30; notes.push('under watermark'); }
      RC.set(P, TH[i].clone().sub(P).normalize()); RC.far = fi.d - 0.3; const hit = RC.intersectObjects(mesh, false)[0];
      if (hit) { bad += 60; notes.push('blocked by ' + (hit.object.name || hit.object.geometry.type)); }
      const fd = V(P.x - TH[i].x, 0, P.z - TH[i].z).normalize().dot(fw(T[i])); if (fd < -0.1) { bad += 25; notes.push('back of head'); }
    }
    for (const o of figs) { if (T.includes(o)) continue; const fi = frameInfo(cam, head(o), R); if (!fi.front) continue;
      const inside = fi.b[0] > 0.02 && fi.b[1] < 0.98 && fi.b[2] > 0.03 && fi.b[3] < 0.97, out = fi.b[1] < 0 || fi.b[0] > 1 || fi.b[3] < 0 || fi.b[2] > 1;
      if (!inside && !out && (!o.extra || fi.b[3] - fi.b[2] > 0.2)) { bad += 35; notes.push('cut other'); }
      // an over-the-shoulder head may frame the shot, but never fill it (QA fails a head over 45 %) or sit under the watermark
      if (!out && fi.b[3] - fi.b[2] > 0.36) { bad += 35; notes.push('fg head big'); }
      if (!out && underMark(fi.b)) { bad += 25; notes.push('other under watermark'); }
      // head and torso of everyone else: may not cover a target's face, and nobody may loom in the foreground
      const chest = o.body.localToWorld(V(0, 1.2, 0)), parts = [[fi, R], [frameInfo(cam, chest, 0.42), 0.42]];
      for (const [pi] of parts) {
        if (!pi.front) continue;
        for (const th of TH) { const ti = frameInfo(cam, th, R); const ox = Math.min(ti.b[1], pi.b[1]) - Math.max(ti.b[0], pi.b[0]), oy = Math.min(ti.b[3], pi.b[3]) - Math.max(ti.b[2], pi.b[2]); if (ox > 0 && oy > 0 && pi.d < ti.d) { bad += 50; notes.push('covered'); } }
        const vis = !(pi.b[1] < 0 || pi.b[0] > 1 || pi.b[3] < 0 || pi.b[2] > 1);
        if (vis && pi.d < 1.8) { bad += 30; notes.push('fg body'); }
      }
    }
    const faceAng = Math.abs(az), sideSign = Math.sign(az || 1);
    let score = bad + Math.abs(faceAng - (spec.angle ?? (TH.length > 1 ? 10 : 32))) / 12 + Math.abs(dh - 0.12) * 2;
    if (side && sideSign !== side && TH.length > 1) score += 6; // keep the 180-degree line inside a scene
    if (spec.prefer) score += Math.hypot(P.x - spec.prefer[0], P.z - spec.prefer[2]) * 0.6;
    res.push({ score, P: P.toArray(), look: look.toArray(), fov, notes: notes.join(','), sideSign });
  }
  cam.position.copy(save.p); cam.quaternion.copy(save.q); cam.fov = save.fov; cam.updateProjectionMatrix();
  res.sort((a, b) => a.score - b.score);
  const best = res[0]; best.bad = best.score >= 20;
  if (!stage.camCache['side:' + spec.scene] && TH.length > 1) stage.camCache['side:' + spec.scene] = best.sideSign;
  if (window.CAMLOG) console.log('autoCam', key, JSON.stringify(best));
  stage.camCache[key] = best; stage._res = res; return best;
}

// Wide/coverage camera search: frame several people (and optional points) together, from anywhere in the stage
// bounds (spec.region narrows it). Rejects cameras inside geometry, views blocked by walls or props, anyone looming in
// the foreground and backs of heads; prefers faces, a natural distance and a moderate lens.
// spec: {frame:[names], pts:[[x,y,z]], hs:[heights], dist, region:[x0,x1,z0,z1], minFov, maxFov, face:[names whose face matters]}
export function wideCam(stage, key, spec) {
  if (stage.camCache[key]) return stage.camCache[key];
  const cam = stage.cam, mesh = solidMeshes(stage), save = { p: cam.position.clone(), q: cam.quaternion.clone(), fov: cam.fov };
  const F = (spec.frame || []).map(n => stage.figs[n]).filter(f => f && f.g.visible);
  const heads = F.map(f => f.head.getWorldPosition(V(0, 0, 0))), feet = F.map(f => f.g.position.clone().setY(Math.max(0, f.g.position.y)));
  const pts = [...heads, ...feet, ...(spec.pts || []).map(p => V(...p))];
  if (!pts.length) return null;
  const centre = pts.reduce((a, b) => a.clone().add(b), V(0, 0, 0)).multiplyScalar(1 / pts.length);
  if (heads.length) centre.y = heads.reduce((a, h) => a + h.y, 0) / heads.length - (spec.drop ?? 0.45);
  const fw = f => { const q = f.body.getWorldQuaternion(new THREE.Quaternion()); const v = V(0, 0, 1).applyQuaternion(q); v.y = 0; return v.normalize(); };
  // search a 14 m square round the people (inside the stage) unless a region is given; whole outdoor stages are far too big
  const sb = stage.bounds, [x0, x1, z0, z1] = spec.region || [Math.max(sb[0], centre.x - 7), Math.min(sb[1], centre.x + 7), Math.max(sb[2], centre.z - 7), Math.min(sb[3], centre.z + 7)], step = spec.step || 0.45, others = Object.values(stage.figs).filter(f => f.g.visible && !F.includes(f));
  const faceSet = new Set((spec.face || spec.frame || []).map(n => stage.figs[n]));
  const res = [];
  for (let x = x0; x <= x1 + 1e-6; x += step) for (let z = z0; z <= z1 + 1e-6; z += step) for (const h of (spec.hs || [1.55, 1.95, 2.5])) {
    const P = V(x, h, z), d = P.distanceTo(centre); if (d < 1.4) continue;
    cam.position.copy(P); cam.fov = 40; cam.lookAt(spec.look ? V(...spec.look) : centre); cam.updateMatrixWorld(true);
    // fov that fits every point with a margin
    const inv = cam.matrixWorldInverse; let need = 0;
    for (const p of pts) { const l = p.clone().applyMatrix4(inv); if (l.z > -0.3) { need = 999; break; } const ay = Math.atan(Math.abs(l.y) / -l.z), ax = Math.atan(Math.abs(l.x) / -l.z / ASPECT); need = Math.max(need, ay, ax); }
    const fov = clamp(need * 2 * 180 / Math.PI * 1.22 + 4, spec.minFov || 26, 100); if (fov > (spec.maxFov || (PORTRAIT ? 76 : 60))) continue;
    cam.fov = fov; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    let bad = 0; const notes = [];
    for (const o of mesh) { const bb = (o.geometry.boundingBox || (o.geometry.computeBoundingBox(), o.geometry.boundingBox)); const pl = P.clone().applyMatrix4(new THREE.Matrix4().copy(o.matrixWorld).invert()); const ex = bb.clone().expandByScalar(0.12 / Math.max(1e-3, o.getWorldScale(V(0, 0, 0)).x)); if (ex.containsPoint(pl) && !o.userData.shell) { bad += 100; notes.push('inside ' + (o.name || 'mesh')); break; } }
    if (bad) continue;
    for (let i = 0; i < F.length; i++) for (const tp of [heads[i], F[i].body.localToWorld(V(0, 1.15, 0))]) {
      RC.set(P, tp.clone().sub(P).normalize()); RC.far = tp.distanceTo(P) - 0.3; const hit = RC.intersectObjects(mesh, false)[0];
      if (hit) { bad += tp === heads[i] ? 60 : 20; notes.push('blocked ' + spec.frame[i] + ' by ' + (hit.object.name || hit.object.geometry.type)); }
    }
    for (const o of others) for (const [pp, r] of [[o.head.getWorldPosition(V(0, 0, 0)), 0.36], [o.body.localToWorld(V(0, 1.2, 0)), 0.42]]) {
      const fi = frameInfo(cam, pp, r); if (!fi.front) continue; const vis = !(fi.b[1] < 0 || fi.b[0] > 1 || fi.b[3] < 0 || fi.b[2] > 1);
      if (vis && fi.d < 2.3) { bad += 40; notes.push('fg ' + o.name); }
      for (const h of heads) { const ti = frameInfo(cam, h, 0.36); const ox = Math.min(ti.b[1], fi.b[1]) - Math.max(ti.b[0], fi.b[0]), oy = Math.min(ti.b[3], fi.b[3]) - Math.max(ti.b[2], fi.b[2]); if (ox > 0 && oy > 0 && fi.d < ti.d) { bad += 40; notes.push('covers'); } }
    }
    for (let i = 0; i < F.length; i++) for (let j = 0; j < F.length; j++) { if (i === j) continue; const a = frameInfo(cam, heads[i], 0.36), b = frameInfo(cam, heads[j], 0.36);
      const ox = Math.min(a.b[1], b.b[1]) - Math.max(a.b[0], b.b[0]), oy = Math.min(a.b[3], b.b[3]) - Math.max(a.b[2], b.b[2]); if (ox > 0.02 && oy > 0.02 && a.d < b.d) { bad += 25; notes.push('heads overlap'); } }
    for (const h of heads) if (underMark(frameInfo(cam, h, 0.36).b)) { bad += 30; notes.push('under watermark'); }
    let facing = 0; for (let i = 0; i < F.length; i++) if (faceSet.has(F[i])) { const v = V(P.x - heads[i].x, 0, P.z - heads[i].z).normalize().dot(fw(F[i])); facing += v < -0.2 ? 6 : v < 0.2 ? 2 : 0; }
    let score = bad + facing + Math.abs(d - (spec.dist || 3.6)) * 1.2 + Math.max(0, fov - (PORTRAIT ? 62 : 44)) / 6 + Math.abs(h - (spec.h || 1.8)) * 0.8;
    if (spec.prefer) score += Math.hypot(P.x - spec.prefer[0], P.z - spec.prefer[2]) * 0.5;
    res.push({ score, P: P.toArray(), look: (spec.look ? V(...spec.look) : centre).toArray(), fov, notes: notes.join(','), bad: bad >= 20 });
  }
  cam.position.copy(save.p); cam.quaternion.copy(save.q); cam.fov = save.fov; cam.updateProjectionMatrix();
  res.sort((a, b) => a.score - b.score);
  const best = res[0] || { score: 999, P: save.p.toArray(), look: [0, 1, 0], fov: 40, notes: 'no candidate', bad: true };
  if (window.CAMLOG) console.log('wideCam', key, JSON.stringify(best));
  stage.camCache[key] = best; stage._res = res; return best;
}

// The camera is chosen with everyone where they are when the shot starts; people move. Re-check the chosen camera later in
// the shot (middle and end) and take the best-scoring candidate whose framed faces stay clear of trees, posts and other
// people the whole time.
const _tc = new THREE.PerspectiveCamera(40, ASPECT, 0.05, 400);
function faceClear(c, f, h, mesh) {
  _tc.position.set(...c.P); _tc.fov = c.fov; _tc.updateProjectionMatrix(); _tc.lookAt(V(...c.look)); _tc.updateMatrixWorld(true);
  const v = h.clone().project(_tc); if (!(v.z < 1 && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.95)) return false;
  const o = _tc.position, R = V(1, 0, 0).applyQuaternion(_tc.quaternion), U = V(0, 1, 0).applyQuaternion(_tc.quaternion); let blocked = 0;
  for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const p = h.clone().addScaledVector(R, a * 0.12 * f.s).addScaledVector(U, b * 0.12 * f.s), d = p.clone().sub(o), dist = d.length();
    RC.set(o, d.normalize()); RC.far = dist - 0.4 * f.s; if (RC.intersectObjects(mesh, false).some(x => !f._own.has(x.object))) blocked++; }
  return blocked < 3;
}
function keepClear(stage, key, spec, t0, t1, pose) {
  const res = stage._res, names = spec.frame || spec.who || []; stage._res = null; if (!res || res.length < 2) return;
  const times = [t0 + (t1 - t0) * 0.5, t1 - 0.2].filter(x => x > t0 + 0.4); if (!times.length) return;
  const cand = res.slice(0, 80).filter((c, i) => i === 0 || !c.bad), ok = cand.map(() => true);
  for (const tt of times) { pose(tt);
    const mesh = solidMeshes(stage); for (const f of Object.values(stage.figs)) if (f.g.visible) { if (!f._own) { f._own = new Set(); f.g.traverse(o => f._own.add(o)); } f.g.traverse(o => { if (o.isMesh) mesh.push(o); }); }
    const H = names.map(n => stage.figs[n]).filter(f => f && f.g.visible).map(f => [f, f.head.getWorldPosition(V(0, 0, 0))]);
    cand.forEach((c, i) => { if (ok[i]) ok[i] = H.every(([f, h]) => faceClear(c, f, h, mesh)); }); }
  const i = ok.indexOf(true); if (i > 0) { stage.camCache[key] = cand[i]; if (window.CAMLOG) console.log('keepClear', key, 'took candidate', i); }
}

// Shot list helper. cuts: [[t, spec]] where spec is {who:[...], ...autoCam opts} or {pos, look, fov, pos2, look2} (hand-made).
// Every cut is resolved with the scene posed at the cut's start time (pose(t0)) so all render chunks pick the same camera.
export function applyShot(stage, scene, cuts, t, end, pose) {
  let ci = 0; for (let i = 0; i < cuts.length; i++) if (t >= cuts[i][0]) ci = i;
  const [t0, spec] = cuts[ci], t1 = cuts[ci + 1] ? cuts[ci + 1][0] : end, k = smooth(t0, t1, t);
  window.SHOTNAME = spec.name || (spec.who ? spec.who.join('+') : 'wide') + '#' + ci;
  window.SHOTINSERT = !!spec.insert;   // an insert (the sky, a hand, a page): the speaker may be out of sight on purpose
  window.SHOTEXPLICIT = !(spec.who || spec.frame);   // hand-made pos/look shots get the lens checks in QA
  const cam = stage.cam;
  if (spec.who || spec.frame) {
    const key = scene + ':' + ci;
    if (!stage.camCache[key]) { pose(t0 + (spec.at ?? 0.02)); spec.frame ? wideCam(stage, key, spec) : autoCam(stage, key, { ...spec, scene }); keepClear(stage, key, spec, t0, t1, pose); pose(t); }
    const c = stage.camCache[key], P = V(...c.P), L = V(...c.look);
    const push = (spec.push ?? 0.05) * k, drift = spec.drift ?? 0.04;
    P.lerp(L, push); P.x += Math.sin(t * 0.31 + ci) * drift * 0.25; P.y += Math.sin(t * 0.23 + ci * 2) * drift * 0.15;
    cam.position.copy(P); cam.fov = c.fov; cam.updateProjectionMatrix(); cam.lookAt(L);
  } else {
    // a 9:16 film uses the shot's own `short: {pos, look, fov, pos2, look2, fov2}` when it has one, else the 16:9 shot opened up
    const S = PORTRAIT && spec.short ? { ...spec, pos2: null, look2: null, fov2: null, ...spec.short } : spec, own = PORTRAIT && spec.short && spec.short.fov;
    const P = V(...S.pos).lerp(V(...(S.pos2 || S.pos)), k), L = V(...S.look).lerp(V(...(S.look2 || S.look)), k);
    // follow: a fixed camera that pans with someone walking (look point eases onto their chest)
    if (S.follow && stage.figs[S.follow]?.g.visible) { const f = stage.figs[S.follow]; f.g.updateMatrixWorld(true); L.lerp(f.body.localToWorld(V(0, 1.3, 0)), S.followK ?? 0.85); }
    const fv = lerp(S.fov || 36, S.fov2 || S.fov || 36, k);
    cam.position.copy(P); cam.fov = PORTRAIT && !own ? portraitFov(fv) : fv; cam.updateProjectionMatrix(); cam.lookAt(L);
  }
  cam.updateMatrixWorld(true);
  return { ci, t0, t1, k, spec };
}
// Automatic dialogue coverage: one cut per change of speaker (on the speaker, sometimes a two-shot), reaction shots in long
// pauses, hand-made wides for narration and long silences. opts: {wides:[spec...], pairs:[[a,b]...], start, extra:[[t,spec]]}
export function dialogueCuts(scene, opts = {}) {
  const s0 = S0(scene), s1 = S1(scene), Ls = linesOf(scene), cuts = [[s0, opts.wides[0]]];
  let wi = 1, last = null, n = 0;
  const actors = opts.actors || [];
  // the opening wide holds at most 15 % of the scene (a 4 s hold on a 10 s scene put every speaker cut one line late)
  const hold = clamp(Math.min(opts.hold ?? 3.0, (s1 - s0) * 0.15), 0.8, 6);
  const onScreen = Ls.filter(l => l.voice === l.who && actors.includes(l.who));
  for (const l of Ls) {
    const t = Math.max(s0 + hold, l.start - 0.15);
    if (l.voice !== l.who || !actors.includes(l.who)) { if (last !== 'wide' && opts.wides.length) { cuts.push([t, opts.wides[wi++ % opts.wides.length]]); last = 'wide'; } continue; }
    if (last === l.who) continue;
    const other = opts.partner ? opts.partner(l.who) : actors.find(a => a !== l.who);
    const two = other && (n % 3 === 2) && !PORTRAIT;   // 9:16: two people far apart make a tiny two-shot or an over-the-shoulder wall
    cuts.push([t, two ? { who: [l.who, other] } : { who: [l.who] }]); last = l.who; n++;
  }
  for (const e of opts.extra || []) cuts.push(e);
  cuts.sort((a, b) => a[0] - b[0]);
  // whoFrame: speaker shots are searched with wideCam (sees past trees, never from behind) instead of autoCam
  if (opts.drop) for (let i = cuts.length - 1; i > 0; i--) if (opts.drop(cuts[i])) cuts.splice(i, 1);  // drop before whoFrame (it removes .who) and before spacing, so dropped cuts don't push others late
  if (opts.whoFrame) for (const c of cuts) if (c[1].who) { const w = c[1].who, o = opts.whoFrame; c[1] = { name: 'who_' + w.join('_') + '_' + c[0].toFixed(1), frame: w, face: [w[0]], dist: w.length > 1 ? (o.dist2 || 3.4) : (o.dist || 2.6), h: o.h || 1.65, hs: o.hs || [1.45, 1.65, 1.9], at: 0.5, region: o.region, maxFov: PORTRAIT ? 72 : 50 }; }
  // reaction shots and wides in long gaps between lines
  const out = [];
  for (let i = 0; i < cuts.length; i++) { out.push(cuts[i]); }
  // drop cuts that would make a shot shorter than 1.8 s
  // a cut too close to the previous one is pushed back (the earlier speaker keeps the screen); one that runs out of room is dropped
  const clean = []; for (const c of out) {
    const prev = clean[clean.length - 1];
    if (prev && c[0] - prev[0] < 1.8) { const t = prev[0] + 1.8; if (t < s1 - 1.8) clean.push([t, c[1]]); continue; }
    clean.push(c);
  }
  return clean;
}
export const sceneFade = (t, scene, fin = 0.8, fout = 0.9) => Math.max(1 - smooth(S0(scene), S0(scene) + fin, t), smooth(S1(scene) - fout, S1(scene), t));
export { lerpAngle, yawTo, hang, ikW, walkArms };
