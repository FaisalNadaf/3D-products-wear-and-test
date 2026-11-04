/**
 * Anchor definitions in MediaPipe's canonical face space (centimetres).
 * Canonical frame: +X = subject's left (image right), +Y = up, +Z = out of the
 * face toward the camera; origin ≈ centre of the head.
 *
 * Each face anchor also lists nearby mesh landmarks. At runtime the offset
 * between those detected landmarks and where the rigid head pose predicts
 * them is applied as a correction, so anchors adapt to individual face shape
 * (wider jaws, longer faces) instead of assuming the canonical average.
 */
export type FaceAnchorId = 'earLeft' | 'earRight' | 'noseLeft' | 'noseRight' | 'forehead';

export interface FaceAnchorDef {
  position: [number, number, number];
  /** landmarks whose detected-vs-predicted offset refines the anchor */
  refs: number[];
  /** how much of the landmark correction to apply (0–1) */
  correction: number;
}

export const FACE_ANCHORS: Record<FaceAnchorId, FaceAnchorDef> = {
  // Earlobe piercing: just behind & below the jaw-ear junction (lm 361/454).
  earLeft: { position: [7.85, -2.7, -3.3], refs: [361, 323, 454, 401], correction: 0.85 },
  earRight: { position: [-7.85, -2.7, -3.3], refs: [132, 93, 234, 177], correction: 0.85 },
  // Nostril (ala) piercing, traditionally worn on the subject's left side.
  noseLeft: { position: [1.86, -1.18, 4.88], refs: [358, 327, 294, 278], correction: 0.9 },
  noseRight: { position: [-1.86, -1.18, 4.88], refs: [129, 98, 64, 48], correction: 0.9 },
  // Centre hairline, where a maang tikka pendant sits.
  forehead: { position: [0, 8.05, 4.62], refs: [10, 151, 109, 338], correction: 0.9 },
};

/** Forehead tilt (rad) so pendants lie on the brow instead of standing upright. */
export const FOREHEAD_TILT = -0.31;
/** Ala surface normal yaw (rad) for nose pins on the left nostril. */
export const NOSE_PIN_YAW = 0.72;

/** Head-space point where the neck frame sits when no body pose is available. */
export const HEAD_TO_NECK: [number, number, number] = [0, -17.2, -2.4];

/** Landmarks used to judge face visibility / framing. */
export const FACE_OUTLINE = { chin: 152, top: 10, left: 454, right: 234, noseTip: 1 };
