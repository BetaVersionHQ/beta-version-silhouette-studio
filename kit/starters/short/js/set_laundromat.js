// Scene 'wash' in the laundromat set (kit/sets/laundromat.js): night, the machines tumbling. Ana folds at the table,
// Ben waits by the change machine, then walks over. The opening wide holds the lit price board on the right wall.
import { V, mk } from './core.js';
import { Actor, S1, applyShot, dialogueCuts, sceneFade } from './stage.js';
import { ST, F, only, lights, machines, TABLE } from './laundromat.js';
import { head } from './util.js';

const m = n => mk('wash', n);
const ANA = [TABLE.x - 0.2, TABLE.z - 0.75], BEN0 = [3.9, -2.0], BEN1 = [2.4, 0.3];
const A = new Actor(ST, 'ana', F.ana, { x: ANA[0], z: ANA[1], yaw: 0 }, [
  ['face', m('walk') + 1.2, 'ben', { dur: 0.9 }],
]);
const Bn = new Actor(ST, 'ben', F.ben, { x: BEN0[0], z: BEN0[1], yaw: Math.atan2(ANA[0] - BEN0[0], ANA[1] - BEN0[1]) }, [
  ['walk', m('walk'), [BEN1], { direct: true, speed: 1.15, face: ANA }],
]);
function pose(t) {
  A.look = t < m('walk') + 1.2 ? V(TABLE.x, TABLE.top, TABLE.z) : head(F.ben); A.lookK = 0.7; A.update(t);
  Bn.look = head(F.ana); Bn.lookK = 0.6; Bn.update(t);
}
let C;
const cuts = () => dialogueCuts('wash', { actors: ['ana', 'ben'], hold: 2.0,
  wides: [
    { name: 'board_wide', pos: [-2.6, 1.75, 3.0], look: [2.6, 1.4, -0.6], fov: 44, pos2: [-2.3, 1.75, 2.8],
      short: { pos: [-3.0, 1.7, 3.3], look: [2.4, 1.45, -0.9], fov: 64 } },
    { name: 'table_two', pos: [1.0, 1.7, 3.3], look: [1.2, 1.25, -0.2], fov: 40 },
  ] });

export function render(t, sname, R) {
  only('ana', 'ben'); lights('night'); machines(t);
  pose(t); C = C || cuts(); applyShot(ST, sname, C, t, S1(sname), pose);
  R.exposure = 1.0; R.bloom = [0.4, 0.8, 0.5];
  R.scene = ST.scene; R.camera = ST.cam; R.fade = sceneFade(t, sname, 1.0, 1.2);
  return { heads: { ana: F.ana.headPivot, ben: F.ben.headPivot } };
}
export const FIGS = F;
