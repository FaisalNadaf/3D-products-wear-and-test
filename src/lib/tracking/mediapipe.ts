import type { FaceLandmarker, FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

type WasmFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;
// the vision bundle is large; load it only when tracking is first needed
export const loadVision = () => import('@mediapipe/tasks-vision');
const vision = loadVision;

/**
 * Lazily created MediaPipe task singletons. WASM + models are self-hosted in
 * /public/mediapipe (see scripts/setup-mediapipe.mjs): frames are processed
 * entirely on-device and never sent anywhere.
 */
const BASE = `${import.meta.env.BASE_URL}mediapipe/`;
export type RunningMode = 'IMAGE' | 'VIDEO';

let fileset: Promise<WasmFileset> | null = null;
export const getVisionFileset = () => (fileset ??= vision().then((v) => v.FilesetResolver.forVisionTasks(`${BASE}wasm`)));

export async function withDelegate<T>(create: (delegate: 'GPU' | 'CPU') => Promise<T>): Promise<T> {
  try {
    return await create('GPU');
  } catch (err) {
    console.warn('[tracking] GPU delegate unavailable, falling back to CPU', err);
    return create('CPU');
  }
}

interface Task<T> {
  instance: T;
  mode: RunningMode;
}

let face: Promise<Task<FaceLandmarker>> | null = null;
let pose: Promise<Task<PoseLandmarker>> | null = null;

export function loadFaceLandmarker(): Promise<Task<FaceLandmarker>> {
  face ??= (async () => {
    const fs = await getVisionFileset();
    const { FaceLandmarker } = await vision();
    const instance = await withDelegate((delegate) =>
      FaceLandmarker.createFromOptions(fs, {
        baseOptions: { modelAssetPath: `${BASE}face_landmarker.task`, delegate },
        runningMode: 'VIDEO',
        numFaces: 1,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputFacialTransformationMatrixes: true,
        outputFaceBlendshapes: false,
      }),
    );
    return { instance, mode: 'VIDEO' as RunningMode };
  })();
  face.catch(() => (face = null));
  return face;
}

export function loadPoseLandmarker(): Promise<Task<PoseLandmarker>> {
  pose ??= (async () => {
    const fs = await getVisionFileset();
    const { PoseLandmarker } = await vision();
    const instance = await withDelegate((delegate) =>
      PoseLandmarker.createFromOptions(fs, {
        baseOptions: { modelAssetPath: `${BASE}pose_landmarker_lite.task`, delegate },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      }),
    );
    return { instance, mode: 'VIDEO' as RunningMode };
  })();
  pose.catch(() => (pose = null));
  return pose;
}

/** Switches a task between still-image and video mode when required. */
export async function ensureMode<T extends FaceLandmarker | PoseLandmarker>(task: Task<T>, mode: RunningMode) {
  if (task.mode !== mode) {
    await task.instance.setOptions({ runningMode: mode });
    task.mode = mode;
  }
  return task.instance;
}
