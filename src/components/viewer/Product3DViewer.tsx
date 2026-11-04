import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import { MathUtils, Vector3, type PerspectiveCamera } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Minus, Plus, RotateCcw, Rotate3d, Loader2, Move3d } from 'lucide-react';
import type { ModelId } from '../../config/models';
import { buildDisplayGroup, type DisplayGroup } from '../../lib/three/display';
import { StudioEnvironment, type LightingPreset } from '../three/StudioEnvironment';

export type Backdrop = 'ivory' | 'white' | 'champagne' | 'blush' | 'noir';
export const BACKDROPS: { id: Backdrop; label: string; css: string }[] = [
  { id: 'ivory', label: 'Ivory', css: 'radial-gradient(ellipse at 50% 35%,#ffffff 0%,#f8f3ea 55%,#ece2d1 100%)' },
  { id: 'white', label: 'White', css: 'radial-gradient(ellipse at 50% 35%,#ffffff 0%,#fbfbfa 60%,#ecebe8 100%)' },
  { id: 'champagne', label: 'Champagne', css: 'radial-gradient(ellipse at 50% 35%,#fbf1dd 0%,#ecd8b2 60%,#d6ba86 100%)' },
  { id: 'blush', label: 'Blush', css: 'radial-gradient(ellipse at 50% 35%,#fdf3f2 0%,#f1d9d6 60%,#dfbcb7 100%)' },
  { id: 'noir', label: 'Noir', css: 'radial-gradient(ellipse at 50% 35%,#3a3431 0%,#1b1816 60%,#0d0b0a 100%)' },
];

interface Props {
  pieces: ModelId[];
  /** label for screen readers */
  label: string;
  lighting?: LightingPreset;
  backdrop?: Backdrop;
  /** hides buttons and hints, disables wheel zoom (embedded showcases) */
  minimal?: boolean;
}

const FOV = 32;

/** Inspectable 3D product view: orbit, zoom, auto-rotate and reset. */
export function Product3DViewer({ pieces, label, lighting = 'studio', backdrop = 'ivory', minimal = false }: Props) {
  const [display, setDisplay] = useState<DisplayGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRotate, setAutoRotate] = useState(true);
  const controls = useRef<OrbitControlsImpl>(null);
  const key = pieces.join('+');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    buildDisplayGroup(pieces)
      .then((d) => alive && setDisplay(d))
      .catch((e) => console.error('[viewer]', e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const zoom = (factor: number) => {
    const c = controls.current;
    if (!c) return;
    const cam = c.object as PerspectiveCamera;
    const offset = new Vector3().subVectors(cam.position, c.target);
    const d = MathUtils.clamp(offset.length() * factor, c.minDistance, c.maxDistance);
    offset.setLength(d);
    cam.position.copy(c.target).add(offset);
    c.update();
  };

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-xl transition-[background] duration-700"
      style={{ background: BACKDROPS.find((b) => b.id === backdrop)?.css }}
      role="img"
      aria-label={`Interactive 3D view of ${label}`}
    >
      <Canvas
        dpr={[1, 2]}
        camera={{ fov: FOV, near: 0.1, far: 500, position: [0, 2, 30] }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false }}
        onPointerDown={() => setAutoRotate(false)}
      >
        <Suspense fallback={null}>
          <StudioEnvironment key={lighting} preset={lighting} />
          <directionalLight position={[6, 12, 10]} intensity={lighting === 'spotlight' ? 2.2 : lighting === 'daylight' ? 0.7 : 1.1} color={lighting === 'boutique' ? '#ffe2bd' : '#ffffff'} />
          {display && (
            <ViewerScene key={key} display={display} controls={controls} autoRotate={autoRotate} zoomable={!minimal} />
          )}
        </Suspense>
      </Canvas>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-champagne" />
        </div>
      )}

      <div hidden={minimal} className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-cocoa shadow-sm backdrop-blur">
        <Move3d className="h-3.5 w-3.5 text-gold" /> Drag to rotate · Pinch or scroll to zoom
      </div>

      <div hidden={minimal} className="absolute right-4 bottom-4 flex flex-col gap-1.5">
        <ViewerButton label="Zoom in" onClick={() => zoom(0.8)}>
          <Plus className="h-4 w-4" />
        </ViewerButton>
        <ViewerButton label="Zoom out" onClick={() => zoom(1.25)}>
          <Minus className="h-4 w-4" />
        </ViewerButton>
        <ViewerButton label={autoRotate ? 'Stop rotating' : 'Auto-rotate'} active={autoRotate} onClick={() => setAutoRotate((a) => !a)}>
          <Rotate3d className="h-4 w-4" />
        </ViewerButton>
        <ViewerButton
          label="Reset view"
          onClick={() => {
            controls.current?.reset();
            setAutoRotate(true);
          }}
        >
          <RotateCcw className="h-4 w-4" />
        </ViewerButton>
      </div>
    </div>
  );
}

function ViewerButton({
  children,
  label,
  onClick,
  active,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-10 w-10 items-center justify-center rounded-md border shadow-sm backdrop-blur transition-colors ${
        active ? 'border-ink bg-ink text-ivory' : 'border-line bg-white/90 text-ink hover:border-champagne'
      }`}
    >
      {children}
    </button>
  );
}

function ViewerScene({
  display,
  controls,
  autoRotate,
  zoomable,
}: {
  zoomable: boolean;
  display: DisplayGroup;
  controls: React.RefObject<OrbitControlsImpl | null>;
  autoRotate: boolean;
}) {
  const { camera, size } = useThree();
  const r = display.sphere.radius;

  // frame the piece: distance so the bounding sphere fits with margin
  useEffect(() => {
    const cam = camera as PerspectiveCamera;
    const vFov = MathUtils.degToRad(FOV);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (size.width / size.height));
    const dist = (r * 1.08) / Math.sin(Math.min(vFov, hFov) / 2);
    cam.position.set(0, r * 0.18, dist);
    cam.near = dist / 50;
    cam.far = dist * 10;
    cam.updateProjectionMatrix();
    const c = controls.current;
    if (c) {
      c.target.set(0, 0, 0);
      c.minDistance = dist * 0.32;
      c.maxDistance = dist * 2.2;
      c.update();
      c.saveState();
    }
  }, [camera, controls, r, size.width, size.height]);

  return (
    <>
      <primitive object={display.group} />
      <ContactShadows position={[0, display.box.min.y - r * 0.04, 0]} opacity={0.32} scale={r * 3.2} blur={2.6} far={r * 1.5} resolution={512} color="#5a4630" />
      <OrbitControls
        ref={controls}
        makeDefault
        enablePan={false}
        enableZoom={zoomable}
        enableDamping
        dampingFactor={0.08}
        autoRotate={autoRotate}
        autoRotateSpeed={1.4}
        rotateSpeed={0.7}
        zoomSpeed={0.7}
      />
    </>
  );
}
