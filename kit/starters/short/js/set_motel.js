// Scene 'lot' in the motel set (kit/sets/motel.js): night, the parking lot under the roadside sign. Ben waits by the sign,
// Ana comes out of room 5 and walks over. The opening wide holds the sign (MOTEL neon + the lit Beta Version box) readable.
import { V, mk } from './core.js';
import { Actor, S0, S1, applyShot, dialogueCuts, sceneFade } from './stage.js';
import { ST, F, only, night } from './motel.js';
import { head } from './util.js';

const m = n => mk('lot', n);
const BEN = [5.2, 7.6], ANA0 = [2.4, 4.6], ANA1 = [3.25, 7.85];
const Bn = new Actor(ST, 'ben', F.ben, { x: BEN[0], z: BEN[1], yaw: Math.atan2(9.5 - BEN[0], 10.5 - BEN[1]) }, [
  ['face', m('walk') + 1.0, 'ana', { dur: 0.9 }],                             // turns from the sign to her as she comes over
]);
const A = new Actor(ST, 'ana', F.ana, { x: ANA0[0], z: ANA0[1], yaw: 0.4 }, [
  ['walk', m('walk'), [ANA1], { direct: true, speed: 1.15, face: BEN }],
]);
function pose(t) {
  A.look = head(F.ben); A.lookK = 0.6; A.update(t);
  Bn.look = t < m('walk') + 1.0 ? V(9.5, 5.5, 10.5) : head(F.ana); Bn.lookK = 0.7; Bn.update(t);
}
let C;
const cuts = () => dialogueCuts('lot', { actors: ['ana', 'ben'], hold: 2.0, whoFrame: { dist: 3.2, dist2: 4.2 },   // wideCam singles: clean of the other person
  wides: [
    { name: 'sign_wide', pos: [0.2, 1.7, 17.5], look: [6.4, 3.8, 7.8], fov: 44, pos2: [0.6, 1.75, 17.0],
      short: { pos: [9.5, 2.4, 21.0], look: [8.0, 4.2, 11.2], fov: 64, pos2: [9.3, 2.4, 20.6] } },
    { name: 'lot_two', pos: [1.0, 1.7, 11.5], look: [4.6, 1.3, 7.0], fov: 38 },
  ] });

export function render(t, sname, R) {
  only('ana', 'ben'); night(t);
  pose(t); C = C || cuts(); applyShot(ST, sname, C, t, S1(sname), pose);
  R.exposure = 1.2; R.bloom = [0.7, 0.62, 0.55];
  R.scene = ST.scene; R.camera = ST.cam; R.fade = sceneFade(t, sname, 1.0, 1.2);
  return { heads: { ana: F.ana.headPivot, ben: F.ben.headPivot } };
}
export const FIGS = F;
