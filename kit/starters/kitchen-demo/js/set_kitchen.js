// Scene 'kitchen' in the kitchen set (kit/sets/kitchen.js): his phone buzzes face down on the table (back logo up); Ana
// turns from the counter; Ben reaches, picks it up and reads it (the back logo faces the camera); Ana walks to the table.
import { V, THREE, smooth, mk, linesOf, lineEnd, handWorld } from './core.js';
import { Actor, S1, applyShot, dialogueCuts, sceneFade, ikW } from './stage.js';
import { ST, F, only, lights, PHONE, TABLE, COUNTER_AT } from './kitchen.js';
import { head } from './util.js';

const m = n => mk('kitchen', n);
const ANA1 = [-0.35, -0.45], PH = [TABLE.x + 0.18, TABLE.top, TABLE.z - 0.32, 1.2];   // phone: x, table top, z, yaw (face down)
const A = new Actor(ST, 'ana', F.ana, { x: COUNTER_AT[0], z: COUNTER_AT[1], yaw: Math.PI }, [
  ['face', m('buzz') + 0.4, 'ben', { dur: 0.8 }],
  ['walk', m('reach') + 0.15, [ANA1], { direct: true, speed: 1.1, face: 'ben' }],
]);
const Bn = new Actor(ST, 'ben', F.ben, { seat: 'chair_back' }, []);
// the pick-up: reach (0.55 s), grab, lift in front of his chest facing him (0.65 s), hold; the screen lights as he lifts it
const R0 = () => m('reach'), GRAB = () => m('reach') + 0.55, UP = () => m('reach') + 1.2;
const qTable = new THREE.Quaternion(), qView = new THREE.Quaternion(), tmp = new THREE.Object3D();
function pose(t) {
  const lastL = linesOf('kitchen').at(-1);
  A.look = head(F.ben); A.lookK = 0.7; A.update(t);
  Bn.look = t > R0() - 0.2 && t < lastL.start + 0.2 ? PHONE.getWorldPosition(V(0, 0, 0)) : head(F.ana); Bn.lookK = 0.8; Bn.update(t);
  // the phone on the table, buzzing (a small spin in place, never lifted off the table)
  PHONE.lay(...PH, true); PHONE.setGlow(false);
  const buzzing = (t > m('buzz') && t < m('buzz') + 1.6) || (t > m('reach') - 0.45 && t < m('reach') + 0.5);   // it buzzes again as he reaches
  const buzz = buzzing ? Math.sin(t * 90) * 0.025 * (Math.sin(t * 14) > -0.2 ? 1 : 0) : 0;
  PHONE.rotation.z += buzz; PHONE.updateMatrixWorld(true); qTable.copy(PHONE.quaternion);
  if (t < R0()) return;
  F.ben.g.updateMatrixWorld(true);
  const rest = handWorld(F.ben.armR), onTable = PHONE.position.clone().add(V(0, 0.05, 0));
  const hd = head(F.ben), view = hd.clone().add(V(0, -0.62, 0.5));
  const kReach = smooth(R0(), GRAB(), t), kLift = smooth(GRAB(), UP(), t);
  const target = t < GRAB() ? rest.lerp(onTable, kReach) : onTable.clone().lerp(view, kLift);
  ikW(F.ben, 'R', target);
  if (t < GRAB()) return;
  // in the hand: follow it, turning from face down to facing his eyes
  F.ben.g.updateMatrixWorld(true);
  const h = handWorld(F.ben.armR), off = V(0, -0.05, 0).lerp(V(0, 0.07, 0.07), kLift);   // from where it lay to held up in front of the fist
  tmp.position.copy(h); tmp.lookAt(h.clone().add(V(0, 0.15, -0.5))); qView.copy(tmp.quaternion);   // screen tilted up to his eyes, back to the lens
  PHONE.position.copy(h).add(off); PHONE.quaternion.copy(qTable).slerp(qView, kLift); PHONE.setGlow(kLift > 0.6);
}
let C;
const cuts = () => dialogueCuts('kitchen', { actors: ['ana', 'ben'], hold: 1.6,
  wides: [
    { name: 'kitchen_wide', pos: [-1.7, 2.0, 3.7], look: [0.7, 1.25, -1.5], fov: 46, pos2: [-1.5, 1.98, 3.4],
      short: { pos: [-0.9, 1.9, 4.4], look: [0.4, 1.3, -1.4], fov: 64 } },
  ],
  whoFrame: { dist: 3.0, dist2: 4.0 },
  // the pick-up insert: a long lens on the phone buzzing face down (back logo up); his hand comes in and lifts it, and the
  // lens tilts with it (render() aims it at the phone) so the back logo stays big; his head stays above the frame
  extra: [[m('reach') - 0.45, { name: 'phone_insert', insert: true, pos: [1.35, 1.5, 1.6], look: [1.05, 0.78, 0], fov: 17,
    short: { pos: [1.35, 1.5, 1.6], look: [1.05, 0.78, 0], fov: 22 } }]] });
const INS_LOOK = V(0, 0, 0);

export function render(t, sname, R) {
  only('ana', 'ben'); lights('night');
  pose(t); C = C || cuts(); applyShot(ST, sname, C, t, S1(sname), pose);
  // the insert tilts with the phone, but never above y 1.05 or his head would come into the top of the frame
  if (window.SHOTNAME === 'phone_insert') { const p = PHONE.getWorldPosition(INS_LOOK); p.y = Math.min(p.y + 0.02, 1.05); ST.cam.lookAt(p); ST.cam.updateMatrixWorld(true); }
  R.exposure = 1.05; R.bloom = [0.45, 0.75, 0.5];
  R.scene = ST.scene; R.camera = ST.cam; R.fade = sceneFade(t, sname, 0.8, 1.0);
  return { heads: { ana: F.ana.headPivot, ben: F.ben.headPivot } };
}
export const FIGS = F;
