import { Environment, Lightformer } from '@react-three/drei';

export type LightingPreset = 'studio' | 'boutique' | 'daylight' | 'spotlight';

export const LIGHTING_PRESETS: { id: LightingPreset; label: string; note: string }[] = [
  { id: 'studio', label: 'Studio', note: 'Soft boxes & sparkle spots' },
  { id: 'boutique', label: 'Warm Boutique', note: 'HDRI · warm interior' },
  { id: 'daylight', label: 'Daylight', note: 'Cool window light' },
  { id: 'spotlight', label: 'Spotlight', note: 'Dramatic single key' },
];

const SPOTS: [number, number, number, number, number][] = [
  [3, 4, 5, 0.45, 16],
  [-4, 3, 4, 0.35, 14],
  [1.5, -2, 6, 0.3, 12],
  [-2.5, 5, -3, 0.35, 12],
  [5, -1, 3, 0.3, 12],
  [-5, -2, 2, 0.3, 10],
  [0, 6, -4, 0.4, 10],
  [2.5, 2, -5, 0.3, 10],
];

/**
 * Jewellery-photography light boxes rendered into an environment map.
 * "studio" (the try-on default) is a warm mid-tone tent so white metals and
 * diamonds never mirror black; "boutique" uses a real studio HDRI.
 */
export function StudioEnvironment({ preset = 'studio' }: { preset?: LightingPreset }) {
  if (preset === 'boutique') {
    return <Environment files={`${import.meta.env.BASE_URL}hdr/studio.hdr`} environmentIntensity={1.15} environmentRotation={[0, 1.2, 0]} />;
  }
  if (preset === 'daylight') {
    return (
      <Environment resolution={256} frames={1} background={false}>
        <color attach="background" args={['#9aa7b5']} />
        <Lightformer form="rect" intensity={5} color="#f4f8ff" position={[-6, 3, 2]} rotation-y={Math.PI / 2} scale={[6, 8, 1]} />
        <Lightformer form="rect" intensity={1.8} color="#ffffff" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#fff4e4" position={[6, 0, 2]} rotation-y={-Math.PI / 2} scale={[3, 6, 1]} />
        {SPOTS.slice(0, 5).map(([x, y, z, s, i], k) => (
          <Lightformer key={k} form="circle" intensity={i * 0.8} position={[x, y, z]} scale={s} />
        ))}
      </Environment>
    );
  }
  if (preset === 'spotlight') {
    return (
      <Environment resolution={256} frames={1} background={false}>
        <color attach="background" args={['#1b1714']} />
        <Lightformer form="circle" intensity={9} color="#fff3df" position={[2, 6, 4]} scale={3} />
        <Lightformer form="rect" intensity={2.2} color="#ffe6c2" position={[-6, 1, -2]} rotation-y={Math.PI / 2} scale={[0.8, 9, 1]} />
        {SPOTS.map(([x, y, z, s, i], k) => (
          <Lightformer key={k} form="circle" intensity={i * 1.2} position={[x, y, z]} scale={s * 0.8} />
        ))}
      </Environment>
    );
  }
  return (
    <Environment resolution={256} frames={1} background={false}>
      <color attach="background" args={['#5b5047']} />
      <Lightformer form="rect" intensity={3.4} color="#fff3e2" position={[0, 6, 1]} rotation-x={Math.PI / 2} scale={[11, 7, 1]} />
      <Lightformer form="rect" intensity={3} color="#fff8ee" position={[-6, 1.5, 2]} rotation-y={Math.PI / 2} scale={[1.4, 10, 1]} />
      <Lightformer form="rect" intensity={2.6} color="#f3f6ff" position={[6, 1, 1]} rotation-y={-Math.PI / 2} scale={[1.4, 10, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#fff6ea" position={[0, 0, 8]} scale={[9, 4, 1]} />
      <Lightformer form="ring" intensity={5} color="#ffffff" position={[0, 1.5, 7]} scale={2.4} />
      <Lightformer form="rect" intensity={1.6} color="#f2d9b0" position={[0, -6, 1]} rotation-x={-Math.PI / 2} scale={[12, 8, 1]} />
      <Lightformer form="rect" intensity={1.5} color="#ffe9c9" position={[0, 2, -7]} scale={[12, 3, 1]} />
      {SPOTS.map(([x, y, z, s, i], k) => (
        <Lightformer key={k} form="circle" intensity={i} position={[x, y, z]} scale={s} />
      ))}
    </Environment>
  );
}
