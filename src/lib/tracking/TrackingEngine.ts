import { Euler, MathUtils, Matrix4, Quaternion, Vector3 } from 'three';
import type { FaceLandmarkerResult, NormalizedLandmark, PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { ensureMode, loadFaceLandmarker, loadPoseLandmarker } from './mediapipe';
import { OneEuro, OneEuroQuat, OneEuroVec3 } from './oneEuro';
import { FACE_ANCHORS, HEAD_TO_NECK, type FaceAnchorId } from './anchors';
import { NECK_RADIUS } from './bodyFrame';
import { NeckSolver, type NeckMeasure } from './neckFit';
import canonical from './canonicalFace.json';

/**
 * Camera model shared with the renderer. MediaPipe's facial transformation
 * matrix assumes a pinhole camera with a 63° vertical field of view; using the
 * same projection makes canonical-space anchors land on the real face.
 */
export const CAMERA_FOV = 63;
const TAN_HALF_FOV = Math.tan(MathUtils.degToRad(CAMERA_FOV / 2));

export type TrackingStatus = 'idle' | 'loading' | 'searching' | 'tracking' | 'error';
export type BodySource = 'pose' | 'estimated' | 'none';

export interface TrackingSnapshot {
  status: TrackingStatus;
  faceVisible: boolean;
  bodySource: BodySource;
  /** 0–1: rough framing quality (face size, centring) for UI hints */
  framing: 'good' | 'too-far' | 'too-close' | 'off-centre' | 'unknown';
  fps: number;
  error?: string;
}

export interface HeadState {
  visible: boolean;
  /** canonical-face → camera transform (cm) */
  matrix: Matrix4;
  position: Vector3;
  quaternion: Quaternion;
  /** per-anchor refinement in head-local cm */
  corrections: Record<FaceAnchorId, Vector3>;
  /** seconds since last detection */
  staleness: number;
}

export interface BodyState {
  visible: boolean;
  matrix: Matrix4;
  position: Vector3;
  quaternion: Quaternion;
  scale: number;
  source: BodySource;
}

const ANCHOR_IDS = Object.keys(FACE_ANCHORS) as FaceAnchorId[];
const CV = canonical.vertices;
const canonicalPoint = (i: number, out = new Vector3()) => out.set(CV[i * 3], CV[i * 3 + 1], CV[i * 3 + 2]);

/** Unprojects normalized image coords onto the camera-space plane z = depth (<0). */
export function unproject(u: number, v: number, depth: number, aspect: number, out = new Vector3()) {
  const d = -depth;
  return out.set((u * 2 - 1) * TAN_HALF_FOV * aspect * d, (1 - v * 2) * TAN_HALF_FOV * d, depth);
}

export class TrackingEngine {
  readonly head: HeadState = {
    visible: false,
    matrix: new Matrix4(),
    position: new Vector3(0, 0, -40),
    quaternion: new Quaternion(),
    corrections: Object.fromEntries(ANCHOR_IDS.map((id) => [id, new Vector3()])) as Record<FaceAnchorId, Vector3>,
    staleness: Infinity,
  };
  readonly body: BodyState = {
    visible: false,
    matrix: new Matrix4(),
    position: new Vector3(0, -15, -40),
    quaternion: new Quaternion(),
    scale: 1,
    source: 'none',
  };
  /** source width / height */
  aspect = 4 / 3;
  private _needsBody = false;
  private poseReady = false;
  /** bumps whenever pose data changes; lets on-demand renderers invalidate */
  version = 0;

  private snapshot: TrackingSnapshot = { status: 'idle', faceVisible: false, bodySource: 'none', framing: 'unknown', fps: 0 };
  private listeners = new Set<() => void>();
  private video: HTMLVideoElement | null = null;
  private running = false;
  private rvfcHandle = 0;
  private rafHandle = 0;
  private lastTs = 0;
  private lastFaceTime = -Infinity;
  private lastFrameTime = 0;
  private frame = 0;
  private fpsWindow: number[] = [];
  private lastPoseAt = -Infinity;

  // filters
  private fHeadPos = new OneEuroVec3([1.1, 1.1, 0.55], 0.09);
  private fHeadRot = new OneEuroQuat(1.4, 0.9);
  private fCorr = Object.fromEntries(ANCHOR_IDS.map((id) => [id, new OneEuroVec3(0.8, 0.05)])) as Record<FaceAnchorId, OneEuroVec3>;
  private fBodyPos = new OneEuroVec3([1.0, 1.0, 0.6], 0.06);
  private fBodyRoll = new OneEuro(1.0, 0.4);
  private fBodyYaw = new OneEuro(0.7, 0.3);
  private fBodyScale = new OneEuro(0.4, 0.02);
  private neckSolver: NeckSolver | null = null;
  private chinX: number | null = null;
  private neck: (NeckMeasure & { at: number }) | null = null;
  private fNeckX = new OneEuro(1.2, 0.2);
  private fNeckY = new OneEuro(0.8, 0.1);
  private fNeckW = new OneEuro(0.25, 0.02);

  // scratch
  private m = new Matrix4();
  private p = new Vector3();
  private q = new Quaternion();
  private s = new Vector3();
  private v1 = new Vector3();
  private v2 = new Vector3();
  private qInv = new Quaternion();

  /** Necklaces need shoulder tracking; the pose model loads in the background. */
  get needsBody() {
    return this._needsBody;
  }
  set needsBody(v: boolean) {
    this._needsBody = v;
    if (v && !this.poseReady)
      void loadPoseLandmarker()
        .then(() => (this.poseReady = true))
        .catch((e) => console.warn('[tracking] pose model unavailable; using head-based neck estimate', e));
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.snapshot;

  private setSnapshot(patch: Partial<TrackingSnapshot>) {
    const next = { ...this.snapshot, ...patch };
    const changed = (Object.keys(next) as (keyof TrackingSnapshot)[]).some((k) => next[k] !== this.snapshot[k]);
    if (!changed) return;
    this.snapshot = next;
    this.listeners.forEach((l) => l());
  }

  /** Preloads models so the first detection is instant. */
  async warmUp(withPose = false) {
    if (this.snapshot.status === 'idle' || this.snapshot.status === 'error') this.setSnapshot({ status: 'loading', error: undefined });
    try {
      await loadFaceLandmarker();
      if (withPose) await loadPoseLandmarker();
    } catch (err) {
      this.setSnapshot({ status: 'error', error: 'The face-tracking engine could not start on this device.' });
      throw err;
    }
  }

  /* ----------------------------------------------------------- live video */

  async startVideo(video: HTMLVideoElement) {
    this.stop();
    this.video = video;
    this.reset();
    await this.warmUp(false);
    if (this.video !== video) return; // stopped while loading
    this.running = true;
    this.setSnapshot({ status: 'searching' });
    this.schedule();
  }

  private schedule() {
    const v = this.video;
    if (!this.running || !v) return;
    if ('requestVideoFrameCallback' in v) this.rvfcHandle = v.requestVideoFrameCallback(this.tick);
    else this.rafHandle = requestAnimationFrame(() => this.tick());
  }

  private tick = () => {
    const v = this.video;
    if (!this.running || !v) return;
    if (v.readyState >= 2 && v.videoWidth > 0 && !document.hidden) {
      void this.processVideoFrame(v).finally(() => this.schedule());
    } else this.schedule();
  };

  private async processVideoFrame(v: HTMLVideoElement) {
    const now = performance.now();
    const ts = Math.max(this.lastTs + 1, Math.round(now));
    this.lastTs = ts;
    const dt = this.lastFrameTime ? Math.min(0.2, (now - this.lastFrameTime) / 1000) : 1 / 30;
    this.lastFrameTime = now;
    this.aspect = v.videoWidth / v.videoHeight;
    try {
      const face = await ensureMode(await loadFaceLandmarker(), 'VIDEO');
      const faceRes = face.detectForVideo(v, ts);
      this.applyFace(faceRes, dt, now);

      if (this.needsBody) {
        // the neck changes slowly, so a few measurements a second are plenty
        if (this.frame % 4 === 0) this.measureNeck(v, v.videoWidth, v.videoHeight, faceRes, dt * 4, now);
        // pose is heavier; run it on alternate frames, the filter bridges the gap
        if (this.poseReady && this.frame % 2 === 0) {
          const pose = await ensureMode(await loadPoseLandmarker(), 'VIDEO');
          this.applyPose(pose.detectForVideo(v, ts), dt * 2, now);
        } else if (now - this.lastPoseAt > 400) this.estimateBodyFromHead(dt);
      }
    } catch (err) {
      console.error('[tracking] frame failed', err);
    }
    this.frame++;
    this.version++;
    this.updateFps(now);
  }

  private updateFps(now: number) {
    this.fpsWindow.push(now);
    while (this.fpsWindow.length && now - this.fpsWindow[0] > 1000) this.fpsWindow.shift();
    if (this.frame % 15 === 0) this.setSnapshot({ fps: this.fpsWindow.length });
  }

  /** Stops the live video loop (no-op when showing a still photo). */
  stop() {
    if (!this.video && !this.running) return;
    this.running = false;
    if (this.video && this.rvfcHandle && 'cancelVideoFrameCallback' in this.video) this.video.cancelVideoFrameCallback(this.rvfcHandle);
    cancelAnimationFrame(this.rafHandle);
    this.video = null;
    this.head.visible = false;
    this.body.visible = false;
    this.version++;
    this.setSnapshot({ status: 'idle', faceVisible: false, bodySource: 'none', framing: 'unknown', fps: 0 });
  }

  /** Hides everything and returns to idle (leaving photo mode, resets). */
  clear() {
    this.stop();
    this.reset();
    this.setSnapshot({ status: 'idle', faceVisible: false, bodySource: 'none', framing: 'unknown', fps: 0, error: undefined });
  }

  /* --------------------------------------------------------- still photos */

  async processImage(source: HTMLCanvasElement | HTMLImageElement | ImageBitmap, width: number, height: number) {
    this.stop();
    this.reset();
    this.aspect = width / height;
    this.setSnapshot({ status: 'loading' });
    await this.warmUp(true);
    this.poseReady = true;
    const face = await ensureMode(await loadFaceLandmarker(), 'IMAGE');
    const now = performance.now();
    const faceRes = face.detect(source);
    this.applyFace(faceRes, 0, now);
    this.measureNeck(source, width, height, faceRes, 0, now);
    const pose = await ensureMode(await loadPoseLandmarker(), 'IMAGE');
    this.applyPose(pose.detect(source), 0, now);
    this.version++;
    const found = this.head.visible;
    this.setSnapshot({ status: found ? 'tracking' : 'searching', fps: 0 });
    return found;
  }

  reset() {
    this.fHeadPos.reset();
    this.fHeadRot.reset();
    ANCHOR_IDS.forEach((id) => {
      this.fCorr[id].reset();
      this.head.corrections[id].set(0, 0, 0);
    });
    this.fBodyPos.reset();
    this.fBodyRoll.reset();
    this.fBodyYaw.reset();
    this.fBodyScale.reset();
    this.fNeckX.reset();
    this.fNeckY.reset();
    this.fNeckW.reset();
    this.neck = null;
    this.lastFaceTime = -Infinity;
    this.lastPoseAt = -Infinity;
    this.lastFrameTime = 0;
    this.head.visible = false;
    this.body.visible = false;
    this.body.source = 'none';
    this.version++;
  }

  /* ------------------------------------------------------------- solving */

  private applyFace(res: FaceLandmarkerResult, dt: number, now: number) {
    const lms = res.faceLandmarks[0];
    const mat = res.facialTransformationMatrixes?.[0];
    if (!lms || !mat) {
      this.head.staleness = (now - this.lastFaceTime) / 1000;
      if (this.head.staleness > 0.25) this.head.visible = false;
      if (this.head.staleness > 1.2) {
        this.fHeadPos.reset();
        this.fHeadRot.reset();
      }
      if (this.snapshot.status === 'tracking' || this.snapshot.status === 'searching')
        this.setSnapshot({ status: 'searching', faceVisible: this.head.visible, framing: 'unknown' });
      return;
    }
    this.lastFaceTime = now;
    this.head.staleness = 0;
    this.chinX = lms[152]?.x ?? this.chinX;

    const raw = this.m.fromArray(mat.data);
    raw.decompose(this.p, this.q, this.s);

    // landmark-driven anchor refinement (in head-local space)
    this.qInv.copy(this.q).invert();
    for (const id of ANCHOR_IDS) {
      const def = FACE_ANCHORS[id];
      const corr = this.v1.set(0, 0, 0);
      let n = 0;
      for (const k of def.refs) {
        const lm = lms[k];
        if (!lm) continue;
        const predicted = canonicalPoint(k, this.v2).applyMatrix4(raw);
        const detected = unproject(lm.x, lm.y, predicted.z, this.aspect, new Vector3());
        corr.add(detected.sub(predicted));
        n++;
      }
      if (n) corr.divideScalar(n);
      corr.applyQuaternion(this.qInv).clampLength(0, 1.6);
      this.fCorr[id].filter(corr, dt, this.head.corrections[id]);
    }

    this.fHeadPos.filter(this.p, dt, this.head.position);
    this.fHeadRot.filter(this.q, dt, this.head.quaternion);
    this.head.matrix.compose(this.head.position, this.head.quaternion, this.s.set(1, 1, 1));
    this.head.visible = true;

    this.setSnapshot({
      status: 'tracking',
      faceVisible: true,
      framing: this.judgeFraming(lms),
    });
    if (this.needsBody && now - this.lastPoseAt > 400) this.estimateBodyFromHead(dt);
  }

  /** Measures the wearer's real neck from the image; see neckFit.ts. */
  private measureNeck(source: CanvasImageSource, w: number, h: number, res: FaceLandmarkerResult, dt: number, now: number) {
    const lms = res.faceLandmarks[0];
    if (!lms) return;
    this.neckSolver ??= new NeckSolver();
    const m = this.neckSolver.measure(source, w, h, lms);
    if (!m || m.confidence < 0.45) return;
    this.neck = {
      ...m,
      cx: this.fNeckX.filter(m.cx, dt),
      baseY: this.fNeckY.filter(m.baseY, dt),
      halfW: this.fNeckW.filter(m.halfW, dt),
      at: now,
    };
  }

  /** The measured neck, while it is recent enough to trust. */
  private freshNeck(now: number) {
    return this.neck && now - this.neck.at < 900 ? this.neck : null;
  }

  /**
   * Places the body frame on the measured neck. The base is seen on the front
   * surface of the neck, nearer the camera than the frame's origin, so it is
   * unprojected at that depth to avoid a perspective offset.
   */
  private neckPlacement(neck: NeckMeasure, depth: number) {
    const fPx = 0.5 / TAN_HALF_FOV;
    const halfCm = (neck.halfW * this.aspect * -depth) / fPx;
    const scale = MathUtils.clamp(halfCm / NECK_RADIUS.x, 0.82, 1.32);
    const pos = unproject(neck.cx, neck.baseY, depth + NECK_RADIUS.z * scale, this.aspect, new Vector3());
    pos.z = depth;
    return { pos, scale };
  }

  private judgeFraming(lms: NormalizedLandmark[]): TrackingSnapshot['framing'] {
    const l = lms[234];
    const r = lms[454];
    const top = lms[10];
    const chin = lms[152];
    const width = Math.abs(r.x - l.x);
    const cx = (l.x + r.x) / 2;
    const cy = (top.y + chin.y) / 2;
    if (width < 0.16) return 'too-far';
    if (width > 0.62 || top.y < -0.05 || chin.y > 1.02) return 'too-close';
    if (cx < 0.22 || cx > 0.78 || cy < 0.15 || cy > 0.8) return 'off-centre';
    return 'good';
  }

  private applyPose(res: PoseLandmarkerResult, dt: number, now: number) {
    const lms = res.landmarks[0];
    const world = res.worldLandmarks[0];
    const L = lms?.[11];
    const R = lms?.[12];
    const visible =
      L && R && (L.visibility ?? 1) > 0.55 && (R.visibility ?? 1) > 0.55 && L.y < 1.04 && R.y < 1.04 && L.x > -0.02 && R.x < 1.02;
    if (!visible) {
      if (this.head.visible) this.estimateBodyFromHead(dt);
      else {
        this.body.visible = false;
        this.body.source = 'none';
        this.setSnapshot({ bodySource: 'none' });
      }
      return;
    }
    this.lastPoseAt = now;
    const W = this.aspect; // work in units where image height = 1
    const fPx = 0.5 / TAN_HALF_FOV; // focal length in image-height units
    const dx = (L.x - R.x) * W;
    const dy = (L.y - R.y) * 1;
    const shoulderPx = Math.hypot(dx, dy);

    // yaw from metric world landmarks; 2D width shrinks by cos(yaw)
    let yaw = 0;
    if (world?.[11] && world?.[12]) yaw = Math.atan2(world[11].z - world[12].z, world[11].x - world[12].x);
    yaw = MathUtils.clamp(yaw * 0.9, -0.85, 0.85);
    const roll = Math.atan2(-dy, dx);

    // depth: prefer the face's metric depth, else infer from shoulder width
    const depth = this.head.visible ? this.head.position.z - 1.5 : -(fPx * 35 * Math.cos(yaw)) / Math.max(shoulderPx, 1e-3);
    // neck base sits slightly above the shoulder line
    const up = 0.075 * shoulderPx;
    // without a measured neck, the base of the neck lies between the shoulders' midpoint and the chin
    const shoulderMid = (L.x + R.x) / 2;
    const mx = (this.head.visible && this.chinX !== null ? (shoulderMid + this.chinX) / 2 : shoulderMid) - (Math.sin(roll) * up) / W;
    const my = (L.y + R.y) / 2 - Math.cos(roll) * up;
    const pos = unproject(mx, my, depth, this.aspect, this.v1);

    const widthCm = (shoulderPx * -depth) / fPx / Math.max(0.55, Math.cos(yaw));
    let scale = MathUtils.clamp(widthCm / 37.5, 0.8, 1.12);
    const neck = this.freshNeck(now);
    let target = pos;
    if (neck) {
      const placed = this.neckPlacement(neck, depth);
      target = placed.pos;
      scale = placed.scale;
    }

    this.setBody(target, this.fBodyRoll.filter(roll, dt), this.fBodyYaw.filter(yaw, dt), this.fBodyScale.filter(scale, dt), dt, 'pose');
  }

  /** Neck frame approximated from the head when shoulders are out of view. */
  private estimateBodyFromHead(dt: number) {
    if (!this.head.visible) return;
    const e = new Euler().setFromQuaternion(this.head.quaternion, 'YXZ');
    const yaw = e.y * 0.35;
    const roll = e.z * 0.3;
    const partial = this.q.setFromEuler(new Euler(0, yaw, roll, 'YXZ'));
    let pos = this.v1.set(...HEAD_TO_NECK).applyQuaternion(partial).add(this.head.position);
    let scale = 0.94;
    const neck = this.freshNeck(performance.now());
    if (neck) {
      const placed = this.neckPlacement(neck, pos.z);
      pos = placed.pos;
      scale = placed.scale;
    }
    this.setBody(pos, this.fBodyRoll.filter(roll, dt), this.fBodyYaw.filter(yaw, dt), this.fBodyScale.filter(scale, dt), dt, 'estimated');
  }

  private setBody(pos: Vector3, roll: number, yaw: number, scale: number, dt: number, source: BodySource) {
    this.fBodyPos.filter(pos, dt, this.body.position);
    this.body.quaternion.setFromEuler(new Euler(0, yaw, roll, 'YXZ'));
    this.body.scale = scale;
    this.body.matrix.compose(this.body.position, this.body.quaternion, this.s.set(scale, scale, scale));
    this.body.visible = true;
    this.body.source = source;
    this.setSnapshot({ bodySource: source });
  }
}
