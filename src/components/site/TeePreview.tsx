import { useEffect, useRef } from 'react';
import { DEFAULT_DESIGN } from '../../features/tshirt/design';
import { TeeEngine } from '../../features/tshirt/TeeEngine';

/** Slowly spinning live tee for the homepage; pointer input stays with the page. */
export function TeePreview({ color }: { color: string }) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<TeeEngine | null>(null);
  const colorRef = useRef(color);
  colorRef.current = color;
  const design = (c: string) => {
    const dark = ['#141416', '#2a4f9a', '#1f4d3a', '#b5302a'].includes(c);
    return { ...DEFAULT_DESIGN, color: c, layers: DEFAULT_DESIGN.layers.map((l) => ({ ...l, font: 'Manrope Variable', fill: dark ? '#f2efe6' : '#161a2c', text: 'YOUR\nDESIGN' })) };
  };
  useEffect(() => {
    if (!host.current) return;
    let e: TeeEngine;
    try {
      e = new TeeEngine(host.current, { onSelect: () => undefined, onMove: () => undefined });
    } catch {
      return; // WebGL unavailable: the section's text and link still work
    }
    engine.current = e;
    e.setInteractive(false);
    e.setDesign(design(colorRef.current));
    e.spin(true);
    return () => {
      e.dispose();
      engine.current = null;
    };
  }, []);
  useEffect(() => engine.current?.setDesign(design(color)), [color]);
  return <div ref={host} className="relative h-full w-full" role="img" aria-label="A rotating 3D T-shirt" />;
}
