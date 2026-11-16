// Scene 'door' in the room set (kit/sets/room.js). Contract every set module follows:
//   export function render(t, sname, R) -> hud   (pose everyone at time t, pick the shot, fill R)
//   export const FIGS = {...}                    (footsteps and QA find the figures through it)
// R.exposure, R.bloom = [strength, threshold, radius], R.scene, R.camera, R.fade (0..1). hud.heads = {who: headPivot} places captions.
import { V, smooth, mk, linesOf, lineEnd } from './core.js';
import { Actor, S1, applyShot, dialogueCuts, sceneFade } from './stage.js';
import { ST, F, only, setDoor, DOOR_AT, DOOR_IN, PHONE, LAMP } from './room.js';

const m = n => mk('door', n);
// Actors: a start spot and a time-sorted script. Walk legs come from distance / ~1.2 m/s (never from the next line).
const A = new Actor(ST, 'ana', F.ana, { seat: 'sofaL' }, []);
const Bn = new Actor(ST, 'ben', F.ben, { x: DOOR_AT[0], z: DOOR_AT[1], yaw: -Math.PI / 2, hidden: true }, [
  ['show', m('door') + 0.1, { x: DOOR_AT[0], z: DOOR_AT[1], yaw: -Math.PI / 2 }],
  ['walk', m('door') + 1.2, DOOR_IN, { direct: true, speed: 0.9 }],            // waits outside until the door is mostly open
  ['face', m('ben_in') + 1.35, 'ana', { dur: 0.8 }],                          // stays in the doorway and turns to her
]);
// her phone lies on the coffee table, screen up, lock screen on
PHONE.position.set(-1.5, 0.367, -0.82); PHONE.rotation.set(-Math.PI / 2, 0, 0.4); PHONE.setGlow(true);
function pose(t) {
  setDoor(smooth(m('door'), m('door') + 1.4, t));
  A.look = F.ben.g.visible ? F.ben.head.getWorldPosition(V(0, 0, 0)) : null; A.lookK = 0.7; A.update(t);
  Bn.look = F.ana.head.getWorldPosition(V(0, 0, 0)); Bn.lookK = 0.6; Bn.update(t);
}
// coverage: automatic speaker cuts (searched so no head is cut or blocked) plus hand-made wides.
// A shot may carry short: {pos, look, fov} for the 9:16 format; without it the engine widens the lens for portrait.
let C;
const cuts = () => dialogueCuts('door', { actors: ['ana', 'ben'], hold: 1.5,
  wides: [
    { name: 'room_wide', pos: [2.8, 2.2, 4.2], look: [-0.6, 1.0, -1.6], fov: 40, pos2: [2.5, 2.1, 3.8],
      short: { pos: [3.0, 1.8, 4.4], look: [-0.6, 1.2, -1.6], fov: 60 } },
    { name: 'sofa_two', pos: [-0.9, 1.75, 2.9], look: [-1.2, 1.2, -2.1], fov: 38 },
  ],
  // the door shot holds through his first line (an auto speaker cut would put the camera behind the door leaf)
  drop: c => c[1].who && c[0] > m('door') - 0.5 && c[0] < lineEnd(linesOf('door')[0]),
  extra: [[m('door') - 0.2, { name: 'door', pos: [-0.6, 1.75, 1.2], look: [4.4, 1.25, 3.0], fov: 40,
    short: { pos: [-0.2, 1.7, 0.9], look: [4.4, 1.3, 3.0], fov: 58 } }]] });

export function render(t, sname, R) {
  only('ana', 'ben'); LAMP.intensity = 6;
  pose(t); C = C || cuts(); applyShot(ST, sname, C, t, S1(sname), pose);
  R.exposure = 1.1; R.bloom = [0.55, 0.7, 0.5];
  R.scene = ST.scene; R.camera = ST.cam; R.fade = sceneFade(t, sname, 1.0, 1.2);
  return { heads: { ana: F.ana.headPivot, ben: F.ben.headPivot } };
}
export const FIGS = F;
