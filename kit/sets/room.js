// SET: a small living room at night (sofa, armchair, coffee table, lamp, window, front door to a lit hallway).
// Pattern used by every set: one module builds the Stage, its geometry, lights, seats, footprints and figures;
// a film's js/set_room.js imports it and stages the scenes. Copy and rename it to make a new location.
// Brand in the world: the framed Beta Version poster on the back wall, the mug on the coffee table, the box by the wall,
// the phone (logo on its back, lock screen on its screen). All props come from the branded library (props.js).
import { THREE, V, box, cyl, add, mat, makePhone, makePoster, makeMug, makeBox } from './core.js';
import { Stage } from './stage.js';

export const ST = new Stage('room', { bounds: [-4.5, 6.2, -3.5, 4.3], fov: 36 });
const sc = ST.scene;
sc.background = new THREE.Color(0x0c0e14); sc.fog = new THREE.Fog(0x0c0e14, 14, 40);

// shell: floor, back wall with a window, side walls. Every wall object has depth (frame, sill), never a flat plane on a wall.
const FLOOR = mat(0x3a2e26, 0.8), WALLM = mat(0x2a2c34, 0.95), TRIM = mat(0x8a8070, 0.6);
add(sc, new THREE.Mesh(new THREE.PlaneGeometry(9.2, 8), FLOOR), 0, 0, 0.4, { rx: -Math.PI / 2 });
add(sc, box(9.2, 3.0, 0.2, WALLM), 0, 1.5, -3.6, { cast: true });
add(sc, box(0.2, 3.0, 8, WALLM), -4.6, 1.5, 0.4); add(sc, box(0.2, 3.0, 8, WALLM), 4.6, 1.5, 0.4);
const win = new THREE.Group(); add(sc, win, -3.1, 1.6, -3.47);
add(win, box(1.6, 1.2, 0.06, new THREE.MeshBasicMaterial({ color: 0x1a2a44 })), 0, 0, 0);
for (const [w, h, x, y] of [[1.74, 0.08, 0, 0.64], [1.74, 0.08, 0, -0.64], [0.08, 1.3, -0.83, 0], [0.08, 1.3, 0.83, 0], [0.05, 1.2, 0, 0]]) add(win, box(w, h, 0.1, TRIM), x, y, 0.04);
add(win, box(1.9, 0.06, 0.24, TRIM), 0, -0.7, 0.1);                      // sill

// the front door on the right wall: a real opening with a hinged leaf (a figure waits 0.6 m+ behind it until it is open)
// hinge on the far side (z 3.52) so the open leaf lies against the back of the opening, never between camera and doorway
export const DOOR = new THREE.Group(); DOOR.position.set(4.5, 0, 3.52); sc.add(DOOR);
const leaf = new THREE.Group(); DOOR.add(leaf);
add(leaf, box(0.06, 2.1, 0.92, mat(0x4a3424, 0.6)), 0, 1.05, -0.46, { cast: true });
add(leaf, new THREE.Mesh(new THREE.SphereGeometry(0.035, 24, 16), TRIM), -0.06, 1.0, -0.82);
// a real hallway behind the opening (floor, far wall, side walls), lit, so the doorway is not a black hole
add(sc, new THREE.Mesh(new THREE.PlaneGeometry(1.8, 3.0), mat(0x2e2a26, 0.9)), 5.5, 0.001, 3.06, { rx: -Math.PI / 2 });
add(sc, box(0.15, 2.8, 3.0, mat(0x5a4e44, 0.95)), 6.45, 1.4, 3.06);
add(sc, box(1.8, 2.8, 0.15, mat(0x4a4038, 0.95)), 5.5, 1.4, 1.6); add(sc, box(1.8, 2.8, 0.15, mat(0x4a4038, 0.95)), 5.5, 1.4, 4.5);
export const DOOR_AT = [5.4, 3.06];                                      // where a visitor waits outside
export const DOOR_IN = [3.8, 3.06];                                      // first step inside the opening
// the right wall is solid except for the door opening (z 2.6 - 3.52): walkers can only cross it there
ST.block(4.6, -0.5, 0.3, 6.2, 0, 'right wall'); ST.block(4.6, 4.0, 0.3, 0.9, 0, 'right wall');
export function setDoor(k) { leaf.rotation.y = 1.5 * k; }   // opens into the room, flat against the wall

// furniture (beveled boxes) + footprints walkers route around + seats (hip spot, surface height, facing yaw)
const SOFA = mat(0x5a3a3a, 0.85);
const sofa = new THREE.Group(); add(sc, sofa, -1.2, 0, -2.2);
add(sofa, box(2.2, 0.42, 0.9, SOFA), 0, 0.21, 0, { cast: true }); add(sofa, box(2.2, 0.55, 0.22, SOFA), 0, 0.68, -0.36, { cast: true });
add(sofa, box(0.22, 0.6, 0.9, SOFA), -1.1, 0.3, 0, { cast: true }); add(sofa, box(0.22, 0.6, 0.9, SOFA), 1.1, 0.3, 0, { cast: true });
ST.block(-1.2, -2.2, 2.5, 1.0, 0, 'sofa');
ST.seat('sofaL', -1.75, -2.1, 0.45, 0, 0.45); ST.seat('sofaR', -0.65, -2.1, 0.45, 0, 0.45);
const chair = new THREE.Group(); add(sc, chair, 1.6, 0, -1.6); chair.rotation.y = -0.6;
add(chair, box(0.9, 0.42, 0.85, SOFA), 0, 0.21, 0, { cast: true }); add(chair, box(0.9, 0.6, 0.2, SOFA), 0, 0.7, -0.33, { cast: true });
ST.block(1.6, -1.6, 1.0, 1.0, -0.6, 'armchair');
ST.seat('chair', 1.6 + Math.sin(-0.6) * -0.05, -1.6 + Math.cos(-0.6) * -0.05, 0.45, -0.6, 0.45);
add(sc, box(1.2, 0.36, 0.6, mat(0x2a2018, 0.5)), -1.2, 0.18, -0.9, { cast: true }); ST.block(-1.2, -0.9, 1.3, 0.7, 0, 'coffee table');
const lamp = new THREE.Group(); add(sc, lamp, 0.3, 0, -3.0);
add(lamp, cyl(0.02, 0.02, 1.5, TRIM), 0, 0.75, 0); add(lamp, cyl(0.16, 0.24, 0.3, new THREE.MeshStandardMaterial({ color: 0xffe0b0, emissive: 0xffc080, emissiveIntensity: 0.9 })), 0, 1.6, 0);
ST.blockC(0.3, -3.0, 0.3, 'lamp');

// brand: poster (real frame depth) on the back wall above the sofa, mug on the table, a shipping box by the wall
export const POSTER = makePoster({ w: 1.15, h: 0.75 }); add(sc, POSTER, -1.2, 1.95, -3.495);
export const MUG = makeMug(); add(sc, MUG, -0.85, 0.36, -0.78); MUG.rotation.y = 0.25;
export const BOX = makeBox({ w: 0.5, h: 0.36, d: 0.38 }); add(sc, BOX, 3.7, 0, -2.9); BOX.rotation.y = -0.35; ST.block(3.7, -2.9, 0.6, 0.5, -0.35, 'box');
const posterLight = new THREE.SpotLight(0xffe6c8, 6, 4.5, 0.5, 0.6, 1.5); posterLight.position.set(-1.2, 2.9, -2.2);
posterLight.target.position.set(-1.2, 1.95, -3.5); sc.add(posterLight, posterLight.target);

// lights: cool moonlight through the window, warm lamp, low hemisphere fill
export const hemi = new THREE.HemisphereLight(0x8090b0, 0x201810, 0.5); sc.add(hemi);
const moon = new THREE.DirectionalLight(0x9ab0e0, 0.6); moon.position.set(-3, 5, -6); moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048); sc.add(moon);
export const HALL = new THREE.PointLight(0xffd8a8, 5, 6, 1.6); HALL.position.set(5.7, 2.3, 3.06); sc.add(HALL);   // light outside the door: he is a silhouette against it
export const LAMP = new THREE.PointLight(0xffb070, 6, 9, 1.6); LAMP.position.set(0.3, 1.7, -2.9); LAMP.castShadow = true; sc.add(LAMP);

// figures: black capsule silhouettes with a rim light. opts: bun / ponytail (women), s = scale (children ~0.7)
export const F = {
  ana: ST.fig('ana', 0xffe2cc, { bun: true, s: 0.95 }, 1.05),
  ben: ST.fig('ben', 0xe8ecff, { s: 1.0 }, 1.0),
};
export const PHONE = ST.track(makePhone(), 'phone'); sc.add(PHONE);
export function only(...names) { const keep = new Set(names); for (const [n, f] of Object.entries(ST.figs)) f.g.visible = keep.has(n); }
