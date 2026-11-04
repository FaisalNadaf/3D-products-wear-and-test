import { Quaternion, Vector3 } from 'three';

/**
 * One Euro filter (Casiez et al. 2012): heavy smoothing when still (kills
 * landmark jitter), light smoothing when moving fast (no lag on head turns).
 */
export class OneEuro {
  private x: number | null = null;
  private dx = 0;
  constructor(
    public minCutoff = 1.0,
    public beta = 0.02,
    public dCutoff = 1.0,
  ) {}

  private static alpha(cutoff: number, dt: number) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  filter(value: number, dt: number) {
    if (this.x === null || dt <= 0) {
      this.x = value;
      this.dx = 0;
      return value;
    }
    const d = (value - this.x) / dt;
    this.dx += OneEuro.alpha(this.dCutoff, dt) * (d - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuro.alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }

  reset() {
    this.x = null;
    this.dx = 0;
  }
}

export class OneEuroVec3 {
  private f: OneEuro[];
  constructor(minCutoff: number | [number, number, number], beta = 0.02) {
    const c = Array.isArray(minCutoff) ? minCutoff : [minCutoff, minCutoff, minCutoff];
    this.f = c.map((m) => new OneEuro(m, beta));
  }
  filter(v: Vector3, dt: number, out = v) {
    return out.set(this.f[0].filter(v.x, dt), this.f[1].filter(v.y, dt), this.f[2].filter(v.z, dt));
  }
  reset() {
    this.f.forEach((f) => f.reset());
  }
}

/** Filters a rotation component-wise with hemisphere continuity. */
export class OneEuroQuat {
  private f: OneEuro[];
  private prev = new Quaternion();
  private has = false;
  constructor(minCutoff = 1.5, beta = 0.6) {
    this.f = [0, 1, 2, 3].map(() => new OneEuro(minCutoff, beta));
  }
  filter(q: Quaternion, dt: number, out = q) {
    if (this.has && this.prev.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
    out.set(this.f[0].filter(q.x, dt), this.f[1].filter(q.y, dt), this.f[2].filter(q.z, dt), this.f[3].filter(q.w, dt));
    out.normalize();
    this.prev.copy(out);
    this.has = true;
    return out;
  }
  reset() {
    this.f.forEach((f) => f.reset());
    this.has = false;
  }
}
