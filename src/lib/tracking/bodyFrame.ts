import { CatmullRomCurve3, Vector3 } from 'three';

/**
 * Body ("neck") frame, centimetres. Origin = centre of the neck at the level of
 * the collar base (suprasternal notch height). +X = subject's left, +Y = up,
 * +Z = forward (toward the camera when facing it).
 *
 * The same analytic surface is used to (a) drape necklaces so they rest on
 * the collarbones/chest, (b) build the invisible shadow-receiving skin and
 * (c) size the neck occluder that hides the back of every chain.
 */
export const NECK_RADIUS = { x: 5.3, z: 4.9 };
export const NECK_HEIGHT = 13;
/** Height at which a chain crosses the shoulder crest beside the neck. */
export const CHAIN_CREST_Y = 1.5;

/** Front skin surface depth for points on the upper chest. */
export function chestZ(x: number, y: number) {
  const below = Math.max(0, -y);
  const lateral = Math.min(1, Math.abs(x) / 12);
  return 4.9 + 0.3 * below * (1 - lateral) - 0.03 * x * x;
}

/** Outward unit normal of the chest surface. */
export function chestNormal(x: number, y: number, out = new Vector3()) {
  const e = 0.05;
  const dzdx = (chestZ(x + e, y) - chestZ(x - e, y)) / (2 * e);
  const dzdy = (chestZ(x, y + e) - chestZ(x, y - e)) / (2 * e);
  return out.set(-dzdx, -dzdy, 1).normalize();
}

export interface NecklaceCurveOptions {
  /** how far the front centre falls below the collar base (cm) */
  drop: number;
  /** raises the back of the chain on the nape */
  lift?: number;
  /** gap between chain centreline and skin */
  clearance?: number;
}

/**
 * Closed drape curve: starts at the nape (u = 0), travels round the subject's
 * left side, reaches the front centre at u = 0.5 and returns on the right.
 */
export function necklaceCurve({ drop, lift = 0, clearance = 0.16 }: NecklaceCurveOptions) {
  const front = (x: number, y: number) => new Vector3(x, y, chestZ(x, y) + clearance);
  // Seen from the front the chain climbs the side of the neck, passes over the
  // crest of the trapezius (see createBodyOccluders) and drops out of sight.
  const left = [
    new Vector3(3.4, 1.9 + lift, -4.95),
    new Vector3(5.4, 1.85 + lift, -2.6),
    new Vector3(5.95, CHAIN_CREST_Y + lift, -0.35),
    front(5.72, Math.min(0.1, 0.25 - 0.07 * drop)),
    front(4.95, -0.38 * drop),
    front(3.25, -0.76 * drop),
    front(1.5, -0.95 * drop),
  ];
  const back = new Vector3(0, 1.6 + lift, -5.85);
  const centre = front(0, -drop);
  const right = left.map((p) => new Vector3(-p.x, p.y, p.z)).reverse();
  return new CatmullRomCurve3([back, ...left, centre, ...right], true, 'centripetal');
}

/** Choker ring that hugs the neck itself at height `h` above the collar base. */
export function chokerCurve(h: number, dip = 0.7) {
  const pts: Vector3[] = [];
  const n = 28;
  for (let i = 0; i < n; i++) {
    const th = Math.PI + (i / n) * Math.PI * 2; // back → left → front → right
    const front = (Math.cos(th) + 1) / 2;
    pts.push(
      new Vector3(Math.sin(th) * (NECK_RADIUS.x + 0.5), h - dip * front * front, Math.cos(th) * (NECK_RADIUS.z + 0.5)),
    );
  }
  return new CatmullRomCurve3(pts, true, 'centripetal');
}
