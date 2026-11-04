import { Group, MathUtils, Matrix4, Quaternion, Vector3, type Object3D } from 'three';
import { modelMeta, type ModelId, type ModelMeta } from '../../config/models';
import type { Product } from '../../config/catalog';
import type { TrackingEngine } from '../tracking/TrackingEngine';
import { createLobeOccluder } from './occluders';
import { loadInstance } from './modelLoader';
import { anchorLocal, earFacing, headingQuat, Pendulum } from './placement';

export interface Fit {
  /** size multiplier */
  scale: number;
  /** vertical nudge in cm */
  lift: number;
}

interface Placed {
  obj: Object3D;
  side: 1 | -1;
  pendulum?: Pendulum;
}

interface Item {
  id: ModelId;
  meta: ModelMeta;
  placed: Placed[];
  presence: number;
  target: 0 | 1;
}

const Y = new Vector3(0, 1, 0);
const v = new Vector3();
const q = new Quaternion();
const qFace = new Quaternion();
const qSwing = new Quaternion();
const m = new Matrix4();
const mS = new Matrix4();

/** Owns the jewellery currently worn and places it from tracking data each frame. */
export class JewelStage {
  readonly root = new Group();
  private items: Item[] = [];
  private token = 0;
  private lobes: Object3D[] = [createLobeOccluder(), createLobeOccluder()];

  constructor() {
    this.root.name = 'jewel-stage';
    this.lobes.forEach((l) => this.root.add(l));
  }

  /** Loads the product's models, then cross-fades from the previous product. */
  async setProduct(product: Product | null) {
    const token = ++this.token;
    if (!product) {
      this.items.forEach((i) => (i.target = 0));
      return;
    }
    const loaded = await Promise.all(
      product.pieces.map(async (id) => {
        const meta = modelMeta(id);
        const count = meta.anchor === 'ear' ? 2 : 1;
        const objs = await Promise.all(Array.from({ length: count }, () => loadInstance(id)));
        return { id, meta, objs };
      }),
    );
    if (token !== this.token) return; // superseded by a newer selection
    this.items.forEach((i) => (i.target = 0));
    for (const { id, meta, objs } of loaded) {
      const placed: Placed[] = objs.map((obj, i) => {
        obj.matrixAutoUpdate = meta.anchor === 'ear';
        obj.visible = false;
        this.root.add(obj);
        return { obj, side: i === 0 ? 1 : -1, pendulum: meta.swing ? new Pendulum(meta.swing, 0.18) : undefined };
      });
      this.items.push({ id, meta, placed, presence: 0, target: 1 });
    }
  }

  resetMotion() {
    this.items.forEach((i) => i.placed.forEach((p) => p.pendulum?.reset()));
  }

  /** @returns true while a transition is animating */
  update(engine: TrackingEngine, fit: Fit, dt: number): boolean {
    const { head, body } = engine;
    let animating = false;

    // ease presence toward target; drop fully faded items
    for (const it of this.items) {
      const before = it.presence;
      const speed = it.target ? 4.2 : 7;
      it.presence = MathUtils.damp(it.presence, it.target, speed, dt || 1 / 60);
      if (Math.abs(it.presence - it.target) < 0.004) it.presence = it.target;
      if (it.presence !== before) animating = true;
    }
    this.items = this.items.filter((it) => {
      if (it.target === 0 && it.presence === 0) {
        it.placed.forEach((p) => this.root.remove(p.obj));
        return false;
      }
      return true;
    });

    const hasEar = this.items.some((i) => i.meta.anchor === 'ear' && i.target === 1);
    this.lobes.forEach((l) => (l.visible = hasEar && head.visible));

    for (const it of this.items) {
      // ease-out-back pop for a jewel being "placed"
      const p = it.presence;
      const pop = it.target ? 1 + 0.08 * Math.sin(p * Math.PI) : 1;
      const s = Math.max(1e-4, p * pop * fit.scale);

      for (const pl of it.placed) {
        const { obj, side } = pl;
        switch (it.meta.anchor) {
          case 'ear': {
            const id = side === 1 ? 'earLeft' : 'earRight';
            const local = anchorLocal(head, id, v);
            local.y += fit.lift;
            const facing = earFacing(head.matrix, head.quaternion, local, side);
            obj.visible = head.visible && facing > -0.5;
            if (!obj.visible) break;
            const pivot = local.applyMatrix4(head.matrix);
            qFace.setFromAxisAngle(Y, MathUtils.degToRad((it.meta.faceAngle ?? 30) * side));
            if (pl.pendulum) {
              headingQuat(head.quaternion, q).multiply(qFace);
              pl.pendulum.update(pivot, dt, qSwing);
              q.premultiply(qSwing);
            } else q.copy(head.quaternion).multiply(qFace);
            obj.position.copy(pivot);
            obj.quaternion.copy(q);
            obj.scale.set(s * side, s, s);
            // keep the lobe occluder on the rigid (non-swinging) ear frame
            const lobe = this.lobes[side === 1 ? 0 : 1];
            lobe.position.copy(pivot);
            lobe.quaternion.copy(head.quaternion).multiply(qFace);
            lobe.scale.setScalar(fit.scale);
            break;
          }
          case 'nose':
          case 'forehead': {
            obj.visible = head.visible;
            if (!obj.visible) break;
            const local = anchorLocal(head, it.meta.anchor === 'nose' ? 'noseLeft' : 'forehead', v);
            local.y += fit.lift * 0.5;
            m.copy(head.matrix).multiply(mS.makeTranslation(local.x, local.y, local.z)).multiply(mS.makeScale(s, s, s));
            obj.matrix.copy(m);
            obj.matrixWorldNeedsUpdate = true;
            break;
          }
          case 'body': {
            obj.visible = body.visible;
            if (!obj.visible) break;
            m.copy(body.matrix).multiply(mS.makeTranslation(0, fit.lift, 0)).multiply(mS.makeScale(s, s, s));
            obj.matrix.copy(m);
            obj.matrixWorldNeedsUpdate = true;
            break;
          }
        }
      }
    }
    return animating;
  }

  get wearingBodyPiece() {
    return this.items.some((i) => i.target === 1 && i.meta.anchor === 'body');
  }

  dispose() {
    this.items.forEach((it) => it.placed.forEach((p) => this.root.remove(p.obj)));
    this.items = [];
  }
}
