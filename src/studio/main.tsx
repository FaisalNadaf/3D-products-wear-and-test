import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { MathUtils, type PerspectiveCamera } from 'three';
import { findProduct } from '../config/catalog';
import { buildDisplayGroup, type DisplayGroup } from '../lib/three/display';
import { StudioEnvironment } from '../components/three/StudioEnvironment';
import { CURTAINS, settingsFor } from '../config/curtains';
import { CurtainEngine } from '../features/curtains/CurtainEngine';
import type { Quad } from '../features/curtains/windowDetect';
import { DEFAULT_DESIGN, type Design } from '../features/tshirt/design';
import { TeeEngine } from '../features/tshirt/TeeEngine';

/**
 * Dev-only product photography page: /studio.html?id=<product-id>
 * Renders the real 3D model on a transparent background; scripts/thumbnails.mjs
 * screenshots it to produce the catalogue card images.
 */
const FOV = 26;
declare global {
  interface Window {
    __studioReady?: boolean;
    __curtainIds?: string[];
    __renderCurtain?: (id: string) => Promise<string>;
    __tee?: TeeEngine;
  }
}

function Frame({ d, focusLow }: { d: DisplayGroup; focusLow: boolean }) {
  const { camera, gl, scene } = useThree();
  useEffect(() => {
    const cam = camera as PerspectiveCamera;
    // pendants: frame the pendant and the lower drape rather than the whole chain
    const r = focusLow ? d.sphere.radius * 0.42 : d.sphere.radius;
    const ty = focusLow ? d.box.min.y + r * 0.85 : 0;
    const dist = (r * 1.02) / Math.sin(MathUtils.degToRad(FOV) / 2);
    cam.position.set(0, ty + r * 0.12, dist);
    cam.lookAt(0, ty, 0);
    cam.near = dist / 50;
    cam.far = dist * 5;
    cam.updateProjectionMatrix();
    let frames = 0;
    const tick = () => {
      gl.render(scene, cam);
      if (++frames < 8) requestAnimationFrame(tick);
      else window.__studioReady = true;
    };
    tick();
  }, [camera, gl, scene, d, focusLow]);
  return <primitive object={d.group} />;
}

function Studio() {
  const id = new URLSearchParams(location.search).get('id') ?? '';
  const product = findProduct(id);
  const [d, setD] = useState<DisplayGroup | null>(null);
  useEffect(() => {
    if (product) void buildDisplayGroup(product.pieces).then(setD);
  }, [product]);
  if (!product) return <p>Unknown product {id}</p>;
  return (
    <Canvas
      dpr={1}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
      camera={{ fov: FOV, position: [0, 0, 30] }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    >
      <StudioEnvironment />
      <directionalLight position={[6, 12, 10]} intensity={1.0} />
      {d && <Frame d={d} focusLow={product.category === 'pendants'} />}
    </Canvas>
  );
}

/**
 * /studio.html?curtains=list exposes a helper that renders one curtain with
 * the real engine; scripts/curtain-thumbs.mjs saves the results as card images.
 */
function curtainStudio() {
  const canvas = Object.assign(document.createElement('canvas'), { width: 480, height: 480 });
  document.body.append(canvas);
  const engine = new CurtainEngine(canvas);
  engine.resize(480, 480);
  const wall = Object.assign(document.createElement('canvas'), { width: 960, height: 960 });
  const ctx = wall.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 960, 960);
  g.addColorStop(0, '#f6f2ea');
  g.addColorStop(1, '#e6dfd2');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 960, 960);
  engine.setPhoto(wall, 960, 960);
  const quad = [[0.1, 0.13], [0.9, 0.13], [0.9, 0.96], [0.1, 0.96]] as Quad;
  window.__curtainIds = CURTAINS.map((c) => c.id);
  window.__renderCurtain = async (id: string) => {
    const style = CURTAINS.find((c) => c.id === id)!;
    const blind = style.header === 'roman' || style.header === 'roller';
    engine.setWindow(quad);
    engine.update({ ...settingsFor(style), open: blind ? 0.3 : 0.12, extend: 0, drop: 0, floor: 0.3, mount: 0.05 });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return canvas.toDataURL('image/webp', 0.86);
  };
}

/**
 * /studio.html?tee=regular-half-round&view=front&color=%23ffffff renders one
 * garment full-window for inspection and for scripts/showcase.mjs.
 */
function teeStudio(params: URLSearchParams) {
  const [fit, sleeve, neck] = (params.get('tee') ?? 'regular-half-round').split('-') as [Design['fit'], Design['sleeve'], Design['neck']];
  document.body.style.cssText = `margin:0;height:100vh;background:${params.get('bg') ?? '#dcd9d3'}`;
  const host = document.getElementById('root')!;
  host.style.cssText = 'position:fixed;inset:0';
  const engine = new TeeEngine(host, {
    onSelect: () => undefined,
    onMove: () => undefined,
    onLoading: (l) => {
      if (!l) setTimeout(() => (window.__studioReady = true), 900);
    },
  });
  const design: Design = { ...DEFAULT_DESIGN, fit, sleeve, neck, color: params.get('color') ?? '#ffffff', fabric: (params.get('fabric') as Design['fabric']) ?? 'cotton', layers: params.has('print') ? DEFAULT_DESIGN.layers : [] };
  engine.setDesign(design);
  window.__tee = engine;
}

const search = new URLSearchParams(location.search);
if (search.has('curtains')) curtainStudio();
else if (search.has('tee')) teeStudio(search);
else createRoot(document.getElementById('root')!).render(<Studio />);
