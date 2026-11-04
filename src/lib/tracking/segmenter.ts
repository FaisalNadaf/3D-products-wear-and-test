import type { ImageSegmenter, InteractiveSegmenterLegacy } from '@mediapipe/tasks-vision';
import { getVisionFileset, loadVision, withDelegate, type RunningMode } from './mediapipe';

/**
 * On-device segmentation tasks:
 *  - selfie segmenter: separates the person from the room (background switcher)
 *  - interactive segmenter ("magic touch"): segments the object under a tap
 *    point (used to find windows in room photos)
 */
const BASE = `${import.meta.env.BASE_URL}mediapipe/`;

let selfie: Promise<{ instance: ImageSegmenter; mode: RunningMode }> | null = null;
let interactive: Promise<InteractiveSegmenterLegacy> | null = null;

export function loadSelfieSegmenter() {
  selfie ??= (async () => {
    const [fs, v] = await Promise.all([getVisionFileset(), loadVision()]);
    const instance = await withDelegate((delegate) =>
      v.ImageSegmenter.createFromOptions(fs, {
        baseOptions: { modelAssetPath: `${BASE}selfie_segmenter.tflite`, delegate },
        runningMode: 'VIDEO',
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      }),
    );
    return { instance, mode: 'VIDEO' as RunningMode };
  })();
  selfie.catch(() => (selfie = null));
  return selfie;
}

export async function selfieSegmenter(mode: RunningMode) {
  const task = await loadSelfieSegmenter();
  if (task.mode !== mode) {
    await task.instance.setOptions({ runningMode: mode });
    task.mode = mode;
  }
  return task.instance;
}

export function loadInteractiveSegmenter() {
  interactive ??= (async () => {
    const [fs, v] = await Promise.all([getVisionFileset(), loadVision()]);
    return withDelegate((delegate) =>
      // the keypoint-ROI API that pairs with the magic_touch model
      v.InteractiveSegmenterLegacy.createFromOptions(fs, {
        baseOptions: { modelAssetPath: `${BASE}magic_touch.tflite`, delegate },
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      }),
    );
  })();
  interactive.catch(() => (interactive = null));
  return interactive;
}

/**
 * Turns a confidence mask into an alpha mask in `out` (same size as the
 * mask), with an edge-contrast curve and optional temporal smoothing.
 */
export function maskToAlpha(
  mask: Float32Array,
  width: number,
  height: number,
  out: ImageData,
  prev?: Float32Array,
  temporal = 0.45,
  lo = 0.3,
  hi = 0.7,
) {
  const d = out.data;
  const n = width * height;
  for (let i = 0; i < n; i++) {
    let c = mask[i];
    if (prev) {
      c = prev[i] * temporal + c * (1 - temporal);
      prev[i] = c;
    }
    let t = (c - lo) / (hi - lo);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const a = t * t * (3 - 2 * t);
    const j = i * 4;
    d[j] = d[j + 1] = d[j + 2] = 255;
    d[j + 3] = a * 255;
  }
  return out;
}
