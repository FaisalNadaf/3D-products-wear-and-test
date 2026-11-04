import { useEffect, useState, type RefObject } from 'react';

/**
 * Cheap scene-brightness estimate (0 = dark room, 1 = bright) sampled from a
 * 16×16 downscale of the feed twice a second. Used to keep the jewellery's
 * exposure consistent with the room so metal never looks pasted on.
 */
export function useAmbientLight(source: RefObject<HTMLVideoElement | HTMLImageElement | null>, active: boolean) {
  const [level, setLevel] = useState(0.6);
  useEffect(() => {
    if (!active) return;
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const sample = () => {
      const el = source.current;
      if (!el) return;
      const ready = el instanceof HTMLVideoElement ? el.readyState >= 2 : el.complete && el.naturalWidth > 0;
      if (!ready) return;
      try {
        ctx.drawImage(el, 0, 0, 16, 16);
        const d = ctx.getImageData(0, 0, 16, 16).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        const lum = sum / (d.length / 4) / 255;
        setLevel((prev) => {
          const next = Math.min(1, Math.max(0, (lum - 0.12) / 0.5));
          return Math.abs(next - prev) > 0.03 ? next : prev;
        });
      } catch {
        /* tainted or not ready */
      }
    };
    sample();
    const id = window.setInterval(sample, 500);
    return () => window.clearInterval(id);
  }, [source, active]);
  return level;
}
