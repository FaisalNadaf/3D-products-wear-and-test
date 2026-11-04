import { useCallback, useEffect, useState, type RefObject } from 'react';

/**
 * Element fullscreen with a CSS fallback for browsers (notably iOS Safari)
 * that only allow native fullscreen on <video>.
 */
export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [native, setNative] = useState(false);
  const [pseudo, setPseudo] = useState(false);

  useEffect(() => {
    const onChange = () => setNative(document.fullscreenElement === ref.current && !!ref.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [ref]);

  useEffect(() => {
    if (!pseudo) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPseudo(false);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [pseudo]);

  const toggle = useCallback(async () => {
    const el = ref.current;
    if (!el) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }
    if (pseudo) {
      setPseudo(false);
      return;
    }
    if (el.requestFullscreen && document.fullscreenEnabled) {
      try {
        await el.requestFullscreen({ navigationUI: 'hide' });
        return;
      } catch {
        /* fall through to CSS fullscreen */
      }
    }
    setPseudo(true);
  }, [ref, pseudo]);

  return { isFullscreen: native || pseudo, pseudo, toggle };
}
