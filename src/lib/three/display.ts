import { Box3, Group, Sphere, Vector3, type Object3D } from 'three';
import { modelMeta, type ModelId } from '../../config/models';
import { FOREHEAD_TILT, NOSE_PIN_YAW } from '../tracking/anchors';
import { loadInstance } from './modelLoader';

/** Rotations that present each model face-on for product photography. */
const PRESENT: Partial<Record<ModelId, [number, number, number]>> = {
  'nosepin-diamond': [0, -NOSE_PIN_YAW, 0],
  'nosepin-solitaire': [0, -NOSE_PIN_YAW, 0],
  'nosepin-ruby-flower': [0, -NOSE_PIN_YAW, 0],
  'matha-patti': [0.2, 0, 0],
  'nosering-gold': [0, -(NOSE_PIN_YAW + 0.35), 0],
  'nath-bridal': [0, -0.5, 0],
  'tikka-kundan': [-FOREHEAD_TILT, 0, 0],
  'tikka-diamond-drop': [-FOREHEAD_TILT, 0, 0],
};

const BODY_TILT = 0.32;

async function presentPiece(id: ModelId): Promise<Object3D> {
  const meta = modelMeta(id);
  if (meta.anchor === 'ear') {
    const [l, r] = await Promise.all([loadInstance(id), loadInstance(id)]);
    const w = new Box3().setFromObject(l).getSize(new Vector3()).x;
    const gap = Math.max(0.55, w * 0.35);
    l.position.x = -(w / 2 + gap / 2);
    r.position.x = w / 2 + gap / 2;
    r.scale.x = -1;
    const pair = new Group();
    pair.add(l, r);
    return pair;
  }
  const obj = await loadInstance(id);
  const rot = PRESENT[id];
  if (rot) obj.rotation.set(...rot);
  if (meta.anchor === 'body') obj.rotation.x = BODY_TILT;
  const g = new Group();
  g.add(obj);
  return g;
}

export interface DisplayGroup {
  group: Group;
  sphere: Sphere;
  box: Box3;
}

/**
 * Builds a centred, photographable arrangement: a single piece, an earring
 * pair, or a full set (necklace centred, earrings flanking, face pieces above).
 */
export async function buildDisplayGroup(pieces: ModelId[]): Promise<DisplayGroup> {
  const parts = await Promise.all(pieces.map(async (id) => ({ id, meta: modelMeta(id), obj: await presentPiece(id) })));
  const group = new Group();
  const body = parts.find((p) => p.meta.anchor === 'body');
  if (!body || parts.length === 1) {
    parts.forEach((p, i) => {
      if (i > 0) {
        const prev = new Box3().setFromObject(group);
        const b = new Box3().setFromObject(p.obj);
        p.obj.position.x = prev.max.x - b.min.x + 0.8;
      }
      group.add(p.obj);
    });
  } else {
    group.add(body.obj);
    const B = new Box3().setFromObject(body.obj);
    const centreY = (B.min.y + B.max.y) / 2;
    let topX = 0;
    for (const p of parts) {
      if (p === body) continue;
      const k = 1.7;
      if (p.meta.anchor === 'ear') {
        // split the pair so one earring sits each side of the necklace
        const [l, r] = p.obj.children;
        const single = new Box3().setFromObject(l).getSize(new Vector3()).x;
        const off = (B.max.x - B.min.x) / 2 / k + single * 0.75;
        l.position.x = -off;
        r.position.x = off;
      }
      p.obj.scale.multiplyScalar(k);
      p.obj.updateMatrixWorld(true);
      const b = new Box3().setFromObject(p.obj);
      const size = b.getSize(new Vector3());
      if (p.meta.anchor === 'ear') {
        p.obj.position.y = centreY + (B.max.y - centreY) * 0.25 - (b.max.y + b.min.y) / 2;
      } else {
        p.obj.position.set(topX - (b.min.x + b.max.x) / 2, B.max.y + 0.6 - b.min.y, 0);
        topX += size.x + 1.2;
      }
      group.add(p.obj);
    }
    // centre the row of face pieces above the necklace
    const tops = parts.filter((p) => p !== body && p.meta.anchor !== 'ear');
    if (tops.length) {
      const row = new Box3();
      tops.forEach((t) => row.expandByObject(t.obj));
      const shift = -(row.min.x + row.max.x) / 2;
      tops.forEach((t) => (t.obj.position.x += shift));
    }
  }
  const box = new Box3().setFromObject(group);
  const centre = box.getCenter(new Vector3());
  group.position.sub(centre);
  const sphere = new Box3().setFromObject(group).getBoundingSphere(new Sphere());
  return { group, sphere, box: new Box3().setFromObject(group) };
}
