// Verifies that the window pose recovered from a quad reprojects onto that quad.
import { PerspectiveCamera, Vector3 } from 'three';
import { poseFromQuad } from '../../src/features/curtains/CurtainEngine.ts';

const W = 1600, H = 1200;
const quads: [number, number][][] = [
  [[0.36, 0.2], [0.64, 0.2], [0.64, 0.6], [0.36, 0.6]],
  [[0.2, 0.25], [0.45, 0.2], [0.46, 0.62], [0.19, 0.58]],
];
let worst = 0;
for (const q of quads) {
  const pose = poseFromQuad(q as never, W, H);
  const cam = new PerspectiveCamera(pose.fov, W / H, 0.01, 100);
  cam.updateMatrixWorld();
  const corners = [[0, pose.aspect], [1, pose.aspect], [1, 0], [0, 0]];
  corners.forEach(([x, y], i) => {
    const p = new Vector3(x, y, 0).applyMatrix4(pose.matrix).project(cam);
    const u = (p.x + 1) / 2, v = (1 - p.y) / 2;
    const err = Math.hypot(u - q[i][0], v - q[i][1]);
    worst = Math.max(worst, err);
    console.log(`corner ${i}: projected (${u.toFixed(3)}, ${v.toFixed(3)}) expected (${q[i][0]}, ${q[i][1]})`);
  });
  const up = new Vector3(0, 1, 0).transformDirection(pose.matrix);
  const out = new Vector3(0, 0, 1).transformDirection(pose.matrix);
  console.log('up', up.toArray().map((n) => n.toFixed(2)), 'out', out.toArray().map((n) => n.toFixed(2)), 'aspect', pose.aspect.toFixed(3));
}
console.log(worst < 0.005 ? 'PASS' : 'FAIL', 'max error', worst.toFixed(4));
