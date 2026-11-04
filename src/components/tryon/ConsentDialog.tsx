import { AnimatePresence, motion } from 'motion/react';
import { Camera, Cpu, EyeOff, ShieldCheck, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface Props {
  open: boolean;
  onAllow: () => void;
  onCancel: () => void;
}

export const CONSENT_KEY = 'suvarna.cameraConsent';

export function hasCameraConsent() {
  try {
    return sessionStorage.getItem(CONSENT_KEY) === 'granted';
  } catch {
    return false;
  }
}

export function rememberCameraConsent() {
  try {
    sessionStorage.setItem(CONSENT_KEY, 'granted');
  } catch {
    /* ignore */
  }
}

/** Explains exactly what happens with the camera before the browser prompt appears. */
export function ConsentDialog({ open, onAllow, onCancel }: Props) {
  const allowRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    allowRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-ink/45 backdrop-blur-sm" onClick={onCancel} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="consent-title"
            className="relative w-full max-w-md rounded-t-[28px] bg-ivory p-7 shadow-lift sm:rounded-[28px]"
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            <button onClick={onCancel} className="absolute top-4 right-4 rounded-full p-2 text-muted hover:bg-pearl" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-champagne-soft to-champagne text-ink">
              <Camera className="h-5 w-5" />
            </div>
            <h2 id="consent-title" className="mt-5 font-display text-[28px] leading-tight font-semibold">
              Use your camera to try jewellery on
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-cocoa">
              Your browser will ask for camera permission next. This is how we handle the feed:
            </p>
            <ul className="mt-5 space-y-3.5 text-sm text-cocoa">
              <li className="flex gap-3">
                <Cpu className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                Face tracking runs entirely on this device. The video is never uploaded.
              </li>
              <li className="flex gap-3">
                <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                Nothing is recorded. Photos are only created when you press capture.
              </li>
              <li className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                Stop the camera at any time. It also stops when you leave the page.
              </li>
            </ul>
            <div className="mt-7 flex flex-col-reverse gap-2.5 sm:flex-row">
              <button onClick={onCancel} className="btn-ghost flex-1">
                Not now
              </button>
              <button ref={allowRef} onClick={onAllow} className="btn-primary flex-1">
                <Camera className="h-4 w-4" /> Allow camera
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
