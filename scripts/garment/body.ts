/**
 * Invisible dress form used only while draping: a lofted torso, neck and two
 * arms held slightly away from the body, voxelised into a distance field so
 * cloth can slide over it. Units: cm. y = 0 at the base of the neck; +z is
 * the wearer's front.
 */
const smin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - (h * h * k) / 4;
};

function capsule(px: number, py: number, pz: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, ra: number, rb: number) {
  const bax = bx - ax;
  const bay = by - ay;
  const baz = bz - az;
  const pax = px - ax;
  const pay = py - ay;
  const paz = pz - az;
  const h = Math.min(1, Math.max(0, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz)));
  return Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h) - (ra + (rb - ra) * h);
}

/** The form is proportioned to the garment being draped, as a fitting model would be. */
export interface FormSpec {
  /** half chest width of the pattern */
  cw: number;
  /** half shoulder width of the pattern */
  sw: number;
  /** shoulder drop of the pattern */
  sl: number;
}

const ARM_ANGLE = (31 * Math.PI) / 180;
const ARM_LEN = 74;

export class BodySDF {
  private min = [-90, -100, -36];
  private dims = [181, 121, 73];
  private data: Float32Array;
  private sections: [number, number, number, number][];
  /** arm pose, from the shoulder joint */
  readonly arm: { x: number; y: number; z: number; angle: number; len: number };

  constructor(spec: FormSpec) {
    const w = spec.cw * 0.82;
    const d = spec.cw * 0.27;
    this.sections = [
      // y, half width, half depth, z centre
      [13, 6, 6.2, -0.8],
      [3, 6.4, 6.6, -0.8],
      [0.5, 8.5, 7, -0.8],
      [-2.5, 8.5 + (w - 8.5) * 0.6, Math.min(8.2, d * 0.9 + 1), -0.5],
      [-6, w * 0.97, d * 0.96 + 0.5, -0.2],
      [-14, w, d + 0.6, 0.2],
      [-26, w * 0.98, d + 0.6, 0.4],
      [-42, w * 0.93, d, 0.2],
      [-60, w * 0.95, d, -0.1],
      [-88, w * 0.95, d, -0.1],
    ];
    // the shoulder tip rests on the top of the arm
    this.arm = { x: Math.max(14, spec.sw - 4), y: -spec.sl - 5.2, z: -0.2, angle: ARM_ANGLE, len: ARM_LEN };
    const [nx, ny, nz] = this.dims;
    this.data = new Float32Array(nx * ny * nz);
    let k = 0;
    for (let iz = 0; iz < nz; iz++)
      for (let iy = 0; iy < ny; iy++)
        for (let ix = 0; ix < nx; ix++) this.data[k++] = this.distance(this.min[0] + ix, this.min[1] + iy, this.min[2] + iz);
  }

  section(y: number): [number, number, number] {
    const S = this.sections;
    if (y >= S[0][0]) return [S[0][1], S[0][2], S[0][3]];
    for (let i = 0; i < S.length - 1; i++) {
      const a = S[i];
      const b = S[i + 1];
      if (y <= a[0] && y >= b[0]) {
        let t = (a[0] - y) / (a[0] - b[0]);
        t = t * t * (3 - 2 * t);
        return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
      }
    }
    const l = S[S.length - 1];
    return [l[1], l[2], l[3]];
  }

  private distance(x: number, y: number, z: number) {
    const [a, b, cz] = this.section(y);
    const r = Math.hypot(x / a, (z - cz) / b);
    let torso = (r - 1) * Math.min(a, b);
    torso = Math.max(torso, y - 14, -88 - y);
    const { arm } = this;
    const dx = Math.sin(arm.angle) * arm.len;
    const dy = -Math.cos(arm.angle) * arm.len;
    const arm1 = capsule(x, y, z, arm.x, arm.y, arm.z, arm.x + dx, arm.y + dy, arm.z + 3, 5.2, 3.4);
    const arm2 = capsule(x, y, z, -arm.x, arm.y, arm.z, -arm.x - dx, arm.y + dy, arm.z + 3, 5.2, 3.4);
    return smin(torso, Math.min(arm1, arm2), 3);
  }

  /** Writes [distance, gradient x, y, z] into out, trilinearly sampled. */
  sample(x: number, y: number, z: number, out: Float64Array) {
    const [nx, ny, nz] = this.dims;
    const fx = x - this.min[0];
    const fy = y - this.min[1];
    const fz = z - this.min[2];
    if (fx < 0 || fy < 0 || fz < 0 || fx >= nx - 1 || fy >= ny - 1 || fz >= nz - 1) {
      out[0] = 100;
      return;
    }
    const ix = fx | 0;
    const iy = fy | 0;
    const iz = fz | 0;
    const tx = fx - ix;
    const ty = fy - iy;
    const tz = fz - iz;
    const d = this.data;
    const sy = nx;
    const sz = nx * ny;
    const i = ix + iy * sy + iz * sz;
    const c000 = d[i];
    const c100 = d[i + 1];
    const c010 = d[i + sy];
    const c110 = d[i + 1 + sy];
    const c001 = d[i + sz];
    const c101 = d[i + 1 + sz];
    const c011 = d[i + sy + sz];
    const c111 = d[i + 1 + sy + sz];
    const c00 = c000 + (c100 - c000) * tx;
    const c10 = c010 + (c110 - c010) * tx;
    const c01 = c001 + (c101 - c001) * tx;
    const c11 = c011 + (c111 - c011) * tx;
    const c0 = c00 + (c10 - c00) * ty;
    const c1 = c01 + (c11 - c01) * ty;
    out[0] = c0 + (c1 - c0) * tz;
    const gx = (1 - ty) * (1 - tz) * (c100 - c000) + ty * (1 - tz) * (c110 - c010) + (1 - ty) * tz * (c101 - c001) + ty * tz * (c111 - c011);
    const gy = (1 - tx) * (1 - tz) * (c010 - c000) + tx * (1 - tz) * (c110 - c100) + (1 - tx) * tz * (c011 - c001) + tx * tz * (c111 - c101);
    const gz = (1 - tx) * (1 - ty) * (c001 - c000) + tx * (1 - ty) * (c101 - c100) + (1 - tx) * ty * (c011 - c010) + tx * ty * (c111 - c110);
    const l = Math.hypot(gx, gy, gz) || 1;
    out[1] = gx / l;
    out[2] = gy / l;
    out[3] = gz / l;
  }
}

