import { useLayoutEffect, useState, type RefObject } from 'react';

export function useElementSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((s) => (Math.abs(s.width - width) < 0.5 && Math.abs(s.height - height) < 0.5 ? s : { width, height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/** Size of media fitted into a box (cover crops, contain letterboxes). */
export function fitMedia(box: { width: number; height: number }, media: { width: number; height: number }, mode: 'cover' | 'contain') {
  if (!box.width || !box.height || !media.width || !media.height) return { width: box.width, height: box.height };
  const s = mode === 'cover' ? Math.max(box.width / media.width, box.height / media.height) : Math.min(box.width / media.width, box.height / media.height);
  return { width: media.width * s, height: media.height * s };
}
