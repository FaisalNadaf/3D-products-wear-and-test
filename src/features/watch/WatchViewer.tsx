import { Suspense, forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, OrbitControls, useGLTF, useProgress } from '@react-three/drei';
import gsap from 'gsap';
import { Group, Raycaster, Vector3, type Mesh, type Object3D, type PerspectiveCamera } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { WatchProduct, WatchSpec } from '../../config/watches';
import { ParametricWatch, setCushionProfile } from './ParametricWatch';
import { ReferenceChronograph } from './ReferenceChronograph';

const B = import.meta.env.BASE_URL;
const REFERENCE = `${B}watches/chronograph.glb`;

export type CameraPreset = 'hero' | 'dial' | 'crown' | 'profile' | 'back' | 'strap';
export const CAMERA_PRESETS: { id: CameraPreset; label: string }[] = [
  { id: 'hero', label: 'Hero' },
  { id: 'dial', label: 'Dial macro' },
  { id: 'crown', label: 'Crown' },
  { id: 'profile', label: 'Profile' },
  { id: 'back', label: 'Caseback' },
  { id: 'strap', label: 'Strap' },
];
const PRESET_POS: Record<CameraPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
  hero: { pos: [0.8, 0.72, 1.2], target: [0, -0.16, 0] },
  dial: { pos: [0.02, 0.62, 0.32], target: [0, 0.0, 0.02] },
  crown: { pos: [0.72, 0.14, 0.22], target: [0.12, -0.02, 0] },
  profile: { pos: [1.15, 0.02, 0], target: [0, -0.14, 0] },
  back: { pos: [0.62, -0.62, 0.12], target: [0, -0.06, 0] },
  strap: { pos: [-0.6, -0.25, 0.95], target: [0, -0.35, 0] },
};

export type HotspotId = 'crown' | 'bezel' | 'dial' | 'crystal' | 'strap' | 'caseback';
const HOTSPOT_IDS: HotspotId[] = ['crown', 'bezel', 'dial', 'crystal', 'strap', 'caseback'];
type PinMap = Partial<Record<HotspotId, HTMLButtonElement | null>>;

export interface WatchViewerHandle {
  preset: (p: CameraPreset) => void;
  capture: () => string | null;
}

interface Props {
  product: WatchProduct;
  spec: WatchSpec;
  explode: number;
  autoRotate: boolean;
  hotspots: boolean;
  activeHotspot: HotspotId | null;
  onHotspot: (h: HotspotId) => void;
  /** disables controls (used by the scroll story) */
  interactive?: boolean;
  /** externally driven orbit angle (scroll story) */
  orbit?: number;
  /** false: wheel keeps scrolling the page (embedded heroes) */
  zoomable?: boolean;
}

/** Glass doesn't hide hotspots; hidden parts can't either. */
function isSolidVisible(o: Object3D) {
  if (/glass|crystal/i.test(o.name)) return false;
  for (let c: Object3D | null = o; c; c = c.parent) if (!c.visible) return false;
  return true;
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export const WatchViewer = forwardRef<WatchViewerHandle, Props>(function WatchViewer(props, ref) {
  const supported = useMemo(webglAvailable, []);
  const pins = useRef<PinMap>({});
  if (!supported)
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-cocoa">
        3D preview needs WebGL, which isn’t available in this browser. Specifications and pricing below still update.
      </div>
    );
  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows="percentage"
        dpr={[1, 2]}
        camera={{ fov: 30, near: 0.01, far: 30, position: PRESET_POS.hero.pos }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
      >
        <Suspense fallback={null}>
          <WatchScene {...props} handleRef={ref} pins={pins} />
        </Suspense>
      </Canvas>
      {props.hotspots && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {HOTSPOT_IDS.map((h) => (
            <button
              key={h}
              ref={(el) => {
                pins.current[h] = el;
              }}
              onClick={() => props.onHotspot(h)}
              aria-label={`About the ${h}`}
              style={{ opacity: 0 }}
              title={`About the ${h}`}
              className="group absolute top-0 left-0 flex h-8 w-8 items-center justify-center transition-opacity duration-300"
            >
              {/* a quiet marker: a small ring that fills when its part is open */}
              <span
                className={`block h-3 w-3 rounded-full border-2 shadow-[0_0_0_3px_rgba(255,255,255,.35),0_1px_4px_rgba(0,0,0,.35)] transition-[transform,background-color] duration-200 group-hover:scale-125 ${
                  props.activeHotspot === h ? 'scale-125 border-white bg-ink' : 'border-white bg-white/60'
                }`}
              />
            </button>
          ))}
        </div>
      )}
      <Loader />
    </div>
  );
});

function Loader() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3" role="status">
      <div className="h-px w-40 overflow-hidden bg-line">
        <div className="h-full bg-gold transition-[width] duration-300" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-[11px] font-semibold tracking-[0.2em] text-muted uppercase">Loading timepiece · {Math.round(progress)}%</p>
    </div>
  );
}

type Model = ParametricWatch | ReferenceChronograph;

function WatchScene({ product, spec, explode, autoRotate, hotspots, interactive = true, orbit, zoomable = true, handleRef, pins }: Props & { handleRef: React.ForwardedRef<WatchViewerHandle>; pins: React.RefObject<PinMap> }) {
  const gltf = useGLTF(REFERENCE, false, true);
  const { camera, gl, scene, size } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const display = useRef<Group>(null);
  const specRef = useRef(spec);
  specRef.current = spec;
  const frameNo = useRef(0);
  const [ray, world, dir, ndc] = useMemo(() => [new Raycaster(), new Vector3(), new Vector3(), new Vector3()] as const, []);

  // measure the cushion once so straps drape along its real cross-section
  useMemo(() => {
    const base = gltf.scene.getObjectByName('base') as (Mesh & { isMesh?: boolean }) | undefined;
    const mesh = base?.isMesh ? base : (base?.children.find((c) => (c as Mesh).isMesh) as Mesh | undefined);
    if (mesh) setCushionProfile(mesh);
  }, [gltf.scene]);

  // one model per product; options are applied incrementally
  const model = useMemo<Model>(() => {
    if (product.source.kind === 'glb') return new ReferenceChronograph(gltf.scene, specRef.current);
    return new ParametricWatch(product.source.geometry, product.collection, specRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, gltf.scene]);
  const cushion = useMemo(() => {
    const ref = gltf.scene.getObjectByName('base');
    return ref ? ref.clone(true) : null;
  }, [gltf.scene]);
  useEffect(() => () => model.dispose(), [model]);
  useEffect(() => model.apply(spec), [model, spec]);

  // animated explode
  const exp = useRef({ v: 0 });
  useEffect(() => {
    const t = gsap.to(exp.current, { v: explode, duration: 1.1, ease: 'power3.inOut', onUpdate: () => model.setExplode(exp.current.v) });
    return () => void t.kill();
  }, [explode, model]);

  useImperativeHandle(handleRef, () => ({
    preset(p) {
      const c = controls.current;
      // the cushion would block the view of the caseback
      if (cushion) cushion.visible = p !== 'back';
      const { pos, target } = PRESET_POS[p];
      gsap.to(camera.position, { x: pos[0], y: pos[1], z: pos[2], duration: 1.4, ease: 'power3.inOut', onUpdate: () => c?.update() });
      if (c) gsap.to(c.target, { x: target[0], y: target[1], z: target[2], duration: 1.4, ease: 'power3.inOut' });
    },
    capture() {
      gl.render(scene, camera);
      return gl.domElement.toDataURL('image/png');
    },
  }));

  // intro fly-in
  useEffect(() => {
    if (!interactive) return;
    camera.position.set(1.4, 0.9, -1.2);
    const { pos } = PRESET_POS.hero;
    const tl = gsap.to(camera.position, { x: pos[0], y: pos[1], z: pos[2], duration: 2.6, ease: 'power3.out', onUpdate: () => controls.current?.update() });
    return () => void tl.kill();
  }, [camera, interactive, product.id]);

  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __watchGl?: unknown }).__watchGl = gl;
  }, [gl]);

  useFrame((_, dt) => {
    model.tick(new Date(), dt);
    if (orbit !== undefined) {
      const cam = camera as PerspectiveCamera;
      const r = 1.75;
      cam.position.set(Math.sin(orbit) * r, 0.62 + Math.cos(orbit * 0.7) * 0.2, Math.cos(orbit) * r);
      cam.lookAt(0, -0.14, 0);
    }
    // keep the DOM hotspot pins on their 3D anchors; occlusion is raycast a few times a second
    if (hotspots) {
      const check = frameNo.current++ % 12 === 0;
      for (const h of HOTSPOT_IDS) {
        const el = pins.current[h];
        if (!el) continue;
        const a = model.anchors[h];
        world.copy(a);
        if (model instanceof ParametricWatch) world.multiplyScalar(0.01);
        if (check) {
          dir.copy(world).sub(camera.position);
          const dist = dir.length();
          ray.set(camera.position, dir.normalize());
          const hits = ray.intersectObject(display.current ?? scene, true);
          const blocked = hits.some((x) => x.distance < dist - 0.025 && isSolidVisible(x.object));
          el.dataset.hidden = blocked ? '1' : '';
        }
        ndc.copy(world).project(camera);
        const x = (ndc.x * 0.5 + 0.5) * size.width;
        const y = (-ndc.y * 0.5 + 0.5) * size.height;
        el.style.transform = `translate(${x - 16}px, ${y - 16}px)`;
        const hidden = el.dataset.hidden === '1' || ndc.z > 1;
        el.style.opacity = hidden ? '0' : '1';
        el.style.pointerEvents = hidden ? 'none' : 'auto';
      }
    }
  });


  return (
    <>
      <Environment files={`${B}hdr/studio.hdr`} environmentIntensity={1.1} />
      <ambientLight intensity={0.15} />
      <directionalLight position={[0.4, 1.4, 0.8]} intensity={2.4} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-radius={6}>
        <orthographicCamera attach="shadow-camera" args={[-0.8, 0.8, 0.8, -0.8, 0.1, 4]} />
      </directionalLight>
      <group ref={display} position={[0, 0, 0]}>
        <primitive object={model.root} />
        {cushion && <primitive object={cushion} />}
      </group>
      <ContactShadows position={[0, -0.535, 0]} opacity={0.38} scale={2.4} blur={2.4} far={0.8} resolution={512} color="#4a3b2a" />
      {interactive && (
        <OrbitControls
          ref={controls}
          makeDefault
          target={PRESET_POS.hero.target}
          enablePan={false}
          enableZoom={zoomable}
          enableDamping
          dampingFactor={0.07}
          minDistance={0.28}
          maxDistance={2.6}
          autoRotate={autoRotate}
          autoRotateSpeed={0.9}
        />
      )}
    </>
  );
}

useGLTF.preload(REFERENCE, false, true);
