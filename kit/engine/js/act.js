// Acting helpers shared by scene modules: walking routes, arm IK shortcuts, props held in hands.
import { THREE, V, clamp, smooth, lerp, applyPose, standPose, walkPose, plantFeet, liftFeet, ik, ikWorld, handWorld } from './core.js';

// ---------- small helpers ----------
export const lerpAngle = (a, b, k) => { const d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + d * k; };
export const yawTo = (x0, z0, x1, z1) => Math.atan2(x1 - x0, z1 - z0);
export const sideArm = (f, side) => side === 'L' ? f.armL : f.armR;
export const sx = side => side === 'L' ? -1 : 1;
// arms hanging relaxed (body space), optional swing forward/back
export const hang = (f, side, swing = 0) => ik(sideArm(f, side), V(sx(side) * 0.37, 0.9, 0.04 + swing * 0.17), V(sx(side) * 0.25, 0, -1));
export const walkArms = (f, phase, amp = 1) => { hang(f, 'L', Math.sin(phase) * amp); hang(f, 'R', -Math.sin(phase) * amp); };
// body-space target blend helper: ik to a.lerp(b, k)
export const ikB = (f, side, a, b, k, pole) => ik(sideArm(f, side), a.clone().lerp(b, k), pole || V(sx(side) * 0.5, -0.6, -0.6));
// world-space target
export const ikW = (f, side, w, pole) => ikWorld(f, side, w, pole || V(sx(side) * 0.5, -0.6, -0.6));
// world target blended with a body-space rest target (k=0 rest, k=1 world)
export function ikMix(f, side, restBody, world, k, pole) {
  f.g.updateMatrixWorld(true);
  const rw = f.body.localToWorld(restBody.clone());
  ikW(f, side, rw.lerp(world, k), pole);
}

// Route: stand / walk legs. legs = [{t0, t1, pts:[[x,z]...], face}] ; start = {x, z, yaw}
export function route(f, t, start, legs, head) {
  let cx = start.x, cz = start.z, cyaw = start.yaw, fromYaw = start.yaw, arrive = -1e9;
  for (const lg of legs) {
    const p0 = lg.pts[0], p1 = lg.pts[1], dir0 = yawTo(p0[0], p0[1], p1[0], p1[1]);
    if (t < lg.t0) {
      const base = lerpAngle(fromYaw, cyaw, smooth(arrive, arrive + 0.6, t));
      const yaw = lerpAngle(base, dir0, smooth(lg.t0 - 0.45, lg.t0, t));
      return { pose: standPose(f, cx, cz, yaw, head), walking: false, x: cx, z: cz, yaw };
    }
    const n = lg.pts.length, pe = lg.pts[n - 1], pp = lg.pts[n - 2], dirE = yawTo(pp[0], pp[1], pe[0], pe[1]);
    if (t < lg.t1) {
      const u = clamp((t - lg.t0) / (lg.t1 - lg.t0)), ue = lerp(u, u * u * (3 - 2 * u), 0.6);
      const w0 = walkPose(f, lg.pts, ue, {}), total = w0.total;
      if (window.SPEEDS) window.SPEEDS[lg.t0.toFixed(2) + "/" + lg.t1.toFixed(2) + "/" + lg.pts[0].map(v => (+v).toFixed(1)).join(",")] = { t0: lg.t0, t1: lg.t1, m: total, v: total / (lg.t1 - lg.t0) };
      const a = walkPose(f, lg.pts, clamp(ue - 0.3 / total), {}), b = walkPose(f, lg.pts, clamp(ue + 0.3 / total), {});
      const yaw = (b.x - a.x) ** 2 + (b.z - a.z) ** 2 > 1e-6 ? Math.atan2(b.x - a.x, b.z - a.z) : w0.yaw;
      const amp = clamp(Math.min(ue * total, (1 - ue) * total) / 0.3);
      const w = walkPose(f, lg.pts, ue, { amp, yaw, head });
      return { pose: w.pose, walking: true, phase: w.phase, amp, x: w.x, z: w.z, yaw };
    }
    cx = pe[0]; cz = pe[1]; fromYaw = dirE; cyaw = lg.face ?? dirE; arrive = lg.t1;
  }
  const yaw = lerpAngle(fromYaw, cyaw, smooth(arrive, arrive + 0.6, t));
  return { pose: standPose(f, cx, cz, yaw, head), walking: false, x: cx, z: cz, yaw };
}
export function pose(f, p, plant = true) { applyPose(f, p); if (plant && Math.abs(p.tilt || 0) < 0.7 && !p.seated) plantFeet(f); else liftFeet(f); }

// objects held in a hand
export function holdAt(obj, f, side, off = V(0, -0.02, 0)) { obj.position.copy(handWorld(sideArm(f, side))).add(off); }
export function phoneInHands(ph, f, faceUp = true) {
  const h = handWorld(f.armL).add(handWorld(f.armR)).multiplyScalar(0.5);
  ph.position.copy(h).add(V(0, 0.03, 0)); ph.lookAt(f.head.getWorldPosition(V(0, 0, 0)));
}
export function phoneAtEar(ph, f, side) {
  ph.position.copy(handWorld(sideArm(f, side))).add(V(0, 0.04, 0));
  ph.quaternion.copy(f.g.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, sx(side) * Math.PI / 2, 0)));
}
export function flatOn(obj, x, y, z, rz = 0) { obj.position.set(x, y, z); obj.rotation.set(-Math.PI / 2, 0, rz); }

