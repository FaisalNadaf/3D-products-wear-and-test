import { memo, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Group, MathUtils, Vector2, type DirectionalLight } from 'three';
import type { Product } from '../../config/catalog';
import { CAMERA_FOV, type TrackingEngine } from '../../lib/tracking/TrackingEngine';
import { createBodyOccluders, createHeadOccluders } from '../../lib/three/occluders';
import { JewelStage, type Fit } from '../../lib/three/JewelStage';
import { setLibraryEnvIntensity } from '../../lib/three/materials';
import { StudioEnvironment } from '../three/StudioEnvironment';

export interface RendererHandle {
  /** Renders the jewellery layer at an exact pixel size (transparent background). */
  capture(width: number, height: number): HTMLCanvasElement;
}

interface Props {
  engine: TrackingEngine;
  product: Product | null;
  mode: 'live' | 'photo';
  fit: Fit;
  /** scene brightness estimate 0–1 (from the camera feed) */
  ambient: number;
  onReady?: (handle: RendererHandle) => void;
  onModelLoading?: (loading: boolean) => void;
}

/**
 * Transparent WebGL layer drawn over the camera feed / photo. The camera is
 * the same 63° pinhole model MediaPipe solves the head pose against, placed
 * at the origin, so tracked transforms can be applied without conversion.
 */
export const JewelleryRenderer = memo(function JewelleryRenderer(props: Props) {
  const dpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  return (
    <Canvas
      className="!absolute inset-0"
      frameloop={props.mode === 'live' ? 'always' : 'demand'}
      dpr={[1, dpr]}
      shadows="percentage"
      camera={{ fov: CAMERA_FOV, near: 0.5, far: 800, position: [0, 0, 0] }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', premultipliedAlpha: true }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      aria-hidden
    >
      <TryOnScene {...props} />
    </Canvas>
  );
});

function TryOnScene({ engine, product, mode, fit, ambient, onReady, onModelLoading }: Props) {
  const { gl, scene, camera, invalidate } = useThree();
  const light = useRef<DirectionalLight>(null);
  const fitRef = useRef(fit);
  fitRef.current = fit;
  const ambientRef = useRef(ambient);
  ambientRef.current = ambient;
  const lastVersion = useRef(-1);

  const { stage, headRig, bodyRig } = useMemo(() => {
    const headRig = new Group();
    headRig.matrixAutoUpdate = false;
    createHeadOccluders().forEach((o) => headRig.add(o));
    const bodyRig = new Group();
    bodyRig.matrixAutoUpdate = false;
    createBodyOccluders().forEach((o) => bodyRig.add(o));
    return { stage: new JewelStage(), headRig, bodyRig };
  }, []);

  useEffect(() => () => stage.dispose(), [stage]);

  // product switching (models stream in; the previous piece stays until ready)
  useEffect(() => {
    let alive = true;
    onModelLoading?.(true);
    stage
      .setProduct(product)
      .catch((e) => console.error('[renderer] failed to load product', e))
      .finally(() => {
        if (alive) onModelLoading?.(false);
        invalidate();
      });
    return () => {
      alive = false;
    };
  }, [product, stage, invalidate, onModelLoading]);

  // on-demand renders for still photos
  useEffect(() => {
    const unsubscribe = engine.subscribe(() => invalidate());
    return () => void unsubscribe();
  }, [engine, invalidate]);
  useEffect(() => invalidate(), [fit, invalidate, mode]);

  useEffect(() => {
    onReady?.({
      capture(width, height) {
        const size = gl.getSize(new Vector2());
        const prev = gl.getPixelRatio();
        gl.setPixelRatio(width / size.x);
        gl.render(scene, camera);
        const out = document.createElement('canvas');
        out.width = width;
        out.height = height;
        out.getContext('2d')!.drawImage(gl.domElement, 0, 0, width, height);
        gl.setPixelRatio(prev);
        gl.render(scene, camera);
        return out;
      },
    });
  }, [gl, scene, camera, onReady]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const { head, body } = engine;
    headRig.visible = head.visible;
    if (head.visible) {
      headRig.matrix.copy(head.matrix);
      headRig.matrixWorldNeedsUpdate = true;
    }
    bodyRig.visible = body.visible;
    if (body.visible) {
      bodyRig.matrix.copy(body.matrix);
      bodyRig.matrixWorldNeedsUpdate = true;
    }
    const animating = stage.update(engine, fitRef.current, mode === 'live' ? dt : 1 / 30);

    // key light follows the wearer so shadows stay tight and crisp
    const l = light.current;
    if (l) {
      const target = head.visible ? head.position : body.position;
      l.target.position.set(target.x, target.y - 8, target.z);
      l.position.set(target.x + 14, target.y + 26, target.z + 30);
      l.target.updateMatrixWorld();
    }

    // match jewellery brightness to the room: dim rooms get softer metal
    const a = ambientRef.current;
    gl.toneMappingExposure = MathUtils.damp(gl.toneMappingExposure, MathUtils.lerp(0.78, 1.12, a), 3, dt);
    setLibraryEnvIntensity(MathUtils.lerp(0.8, 1.1, a));

    if (mode === 'photo' && (animating || engine.version !== lastVersion.current)) {
      lastVersion.current = engine.version;
      invalidate();
    }
  });

  return (
    <>
      <StudioEnvironment />
      <ambientLight intensity={0.12} />
      <hemisphereLight args={['#fff6ea', '#3b2f26', 0.35]} />
      <directionalLight
        ref={light}
        castShadow
        intensity={1.6}
        color="#fff4e6"
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={5}
        shadow-camera-near={5}
        shadow-camera-far={120}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <primitive object={headRig} />
      <primitive object={bodyRig} />
      <primitive object={stage.root} />
    </>
  );
}
