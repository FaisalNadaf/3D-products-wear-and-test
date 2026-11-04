import { Vector3 } from 'three';
import canonical from '../../tracking/canonicalFace.json';

/**
 * Height-field lookup on MediaPipe's canonical face (cm). Used at model build
 * time so chains that cross the face (nath chain, tikka chain) are draped in
 * front of the skin rather than intersecting it.
 */
const V = canonical.vertices;
const I = canonical.indices;

export function faceSurfaceZ(x: number, y: number): number | null {
  let best: number | null = null;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3;
    const b = I[t + 1] * 3;
    const c = I[t + 2] * 3;
    const ax = V[a], ay = V[a + 1], bx = V[b], by = V[b + 1], cx = V[c], cy = V[c + 1];
    const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(d) < 1e-9) continue;
    const w1 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d;
    const w2 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d;
    const w3 = 1 - w1 - w2;
    if (w1 < 0 || w2 < 0 || w3 < 0) continue;
    const z = w1 * V[a + 2] + w2 * V[b + 2] + w3 * V[c + 2];
    if (best === null || z > best) best = z;
  }
  return best;
}

/** Pushes head-space points forward so they clear the face by `gap` cm. */
export function liftOverFace(points: Vector3[], gap = 0.3) {
  return points.map((p) => {
    const z = faceSurfaceZ(p.x, p.y);
    return z !== null && p.z < z + gap ? new Vector3(p.x, p.y, z + gap) : p.clone();
  });
}

/** Minimum clearance of head-space points from the face (negative = inside). */
export function faceClearance(points: Vector3[]) {
  let min = Infinity;
  for (const p of points) {
    const z = faceSurfaceZ(p.x, p.y);
    if (z !== null) min = Math.min(min, p.z - z);
  }
  return min;
}
