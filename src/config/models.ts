/**
 * 3D model registry. Each model is a GLB in /public/models/<id>.glb authored
 * in real-world centimetres in the frame of its anchor:
 *
 *  - ear:      origin = lobe piercing, hangs toward −Y, display face +Z (left ear)
 *  - nose:     origin = left-ala piercing, head orientation
 *  - forehead: origin = centre hairline, head orientation
 *  - body:     origin = neck centre at collar height (see bodyFrame.ts)
 *
 * To add a model: drop a GLB (materials named after the library in
 * lib/three/materials.ts) into /public/models and register it here.
 */
export type AnchorKind = 'ear' | 'nose' | 'forehead' | 'body';

export interface ModelMeta {
  anchor: AnchorKind;
  /** ear only: yaw (deg) from facing forward toward facing sideways */
  faceAngle?: number;
  /** ear only: pendulum length (cm) for natural swing; omit for rigid studs */
  swing?: number;
  /** product-viewer framing hint */
  previewDistance?: number;
}

export const MODELS = {
  'stud-solitaire': { anchor: 'ear', faceAngle: 40 },
  'stud-gold-flower': { anchor: 'ear', faceAngle: 40 },
  'hoop-gold': { anchor: 'ear', faceAngle: 62, swing: 3.2 },
  'hoop-diamond-huggie': { anchor: 'ear', faceAngle: 55 },
  'jhumka-temple': { anchor: 'ear', faceAngle: 28, swing: 3.8 },
  'drop-sapphire-halo': { anchor: 'ear', faceAngle: 26, swing: 3.4 },
  'chandbali-kundan': { anchor: 'ear', faceAngle: 24, swing: 4.2 },
  'nosepin-diamond': { anchor: 'nose' },
  'nosering-gold': { anchor: 'nose' },
  'nath-bridal': { anchor: 'nose' },
  'tikka-kundan': { anchor: 'forehead' },
  'tikka-diamond-drop': { anchor: 'forehead' },
  'necklace-diamond-riviera': { anchor: 'body' },
  'necklace-temple-gold': { anchor: 'body' },
  'choker-kundan': { anchor: 'body' },
  'necklace-pearl-strand': { anchor: 'body' },
  'chain-cable-gold': { anchor: 'body' },
  'chain-rope-gold': { anchor: 'body' },
  'chain-box-white': { anchor: 'body' },
  'pendant-solitaire': { anchor: 'body' },
  'pendant-ruby-drop': { anchor: 'body' },
  'pendant-lotus-gold': { anchor: 'body' },
  'pearl-drop': { anchor: 'ear', faceAngle: 26, swing: 3.4 },
  'pearl-stud': { anchor: 'ear', faceAngle: 40 },
  'gold-ball-stud': { anchor: 'ear', faceAngle: 40 },
  'statement-chandelier': { anchor: 'ear', faceAngle: 22, swing: 4.6 },
  'meenakari-drop': { anchor: 'ear', faceAngle: 24, swing: 3.9 },
  'nosepin-solitaire': { anchor: 'nose' },
  'nosepin-ruby-flower': { anchor: 'nose' },
  'layered-necklace': { anchor: 'body' },
  'rani-haar': { anchor: 'body' },
  'diamond-collar': { anchor: 'body' },
  'pendant-emerald-oval': { anchor: 'body' },
  'matha-patti': { anchor: 'forehead' },
} satisfies Record<string, ModelMeta>;

export type ModelId = keyof typeof MODELS;

export const modelMeta = (id: ModelId): ModelMeta => MODELS[id];
const BASE = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
export const modelUrl = (id: ModelId) => `${BASE}models/${id}.glb`;
