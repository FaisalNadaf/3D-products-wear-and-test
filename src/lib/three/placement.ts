import { MathUtils, Matrix4, Quaternion, Vector3, Euler } from 'three';
import { FACE_ANCHORS, type FaceAnchorId } from '../tracking/anchors';
import type { HeadState } from '../tracking/TrackingEngine';

const Y = new Vector3(0, 1, 0);
const FWD = new Vector3(0, 0, 1);
const tmpV = new Vector3();
const tmpQ = new Quaternion();

/** Anchor position in head space, refined by tracked landmarks. */
export function anchorLocal(head: HeadState, id: FaceAnchorId, out = new Vector3()) {
  const def = FACE_ANCHORS[id];
  return out.set(...def.position).addScaledVector(head.corrections[id], def.correction);
}

/** Rotation about world-up that matches the head's heading (no pitch/roll). */
export function headingQuat(headQ: Quaternion, out = new Quaternion()) {
  const f = tmpV.copy(FWD).applyQuaternion(headQ);
  return out.setFromAxisAngle(Y, Math.atan2(f.x, f.z));
}

/**
 * Damped 2-axis pendulum for hanging earrings. The pivot's acceleration (from
 * head motion) excites the swing; gravity pulls it back to vertical.
 */
export class Pendulum {
  private ax = 0; // rotation about X (forward/back swing)
  private az = 0; // rotation about Z (side swing)
  private vx = 0;
  private vz = 0;
  private prevP = new Vector3();
  private prevV = new Vector3();
  private acc = new Vector3();
  private primed = 0;

  constructor(private length = 3.5, private damping = 0.2) {}

  update(pivotWorld: Vector3, dt: number, out: Quaternion) {
    if (dt <= 0 || dt > 0.25) {
      this.prevP.copy(pivotWorld);
      this.primed = 0;
      return out.identity();
    }
    const v = tmpV.subVectors(pivotWorld, this.prevP).divideScalar(dt);
    this.prevP.copy(pivotWorld);
    if (this.primed < 2) {
      this.prevV.copy(v);
      this.primed++;
      return out.setFromEuler(new Euler(this.ax, 0, this.az));
    }
    // low-pass the noisy second derivative and ignore tracking micro-jitter
    const a = new Vector3().subVectors(v, this.prevV).divideScalar(dt);
    this.prevV.copy(v);
    this.acc.lerp(a, Math.min(1, dt * 18));
    const ex = Math.abs(this.acc.x) > 25 ? this.acc.x : 0;
    const ez = Math.abs(this.acc.z) > 25 ? this.acc.z : 0;

    const g = 981;
    const w2 = g / this.length;
    const c = 2 * this.damping * Math.sqrt(w2);
    const steps = 3;
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const azAcc = -w2 * Math.sin(this.az) - c * this.vz - (ex / this.length) * Math.cos(this.az);
      const axAcc = -w2 * Math.sin(this.ax) - c * this.vx + (ez / this.length) * Math.cos(this.ax);
      this.vz += azAcc * h;
      this.vx += axAcc * h;
      this.az = MathUtils.clamp(this.az + this.vz * h, -0.6, 0.6);
      this.ax = MathUtils.clamp(this.ax + this.vx * h, -0.5, 0.5);
    }
    return out.setFromEuler(new Euler(this.ax, 0, this.az));
  }

  reset() {
    this.ax = this.az = this.vx = this.vz = 0;
    this.primed = 0;
  }
}

/** How much an ear faces the camera (1 = toward, −1 = fully away). */
export function earFacing(headMatrix: Matrix4, headQ: Quaternion, local: Vector3, side: 1 | -1) {
  const p = tmpV.copy(local).applyMatrix4(headMatrix);
  const toCam = p.clone().negate().normalize();
  const n = new Vector3(side * 0.85, 0, 0.53).applyQuaternion(tmpQ.copy(headQ));
  return n.dot(toCam);
}
