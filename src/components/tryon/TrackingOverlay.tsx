import { AnimatePresence, motion } from 'motion/react';
import { Loader2, ScanFace, Sparkles } from 'lucide-react';
import type { TrackingSnapshot } from '../../lib/tracking/TrackingEngine';

interface Props {
  /** controls are overlaid (fullscreen) — lift hints above them */
  overlayControls: boolean;
  snapshot: TrackingSnapshot;
  source: 'camera' | 'photo';
  needsBody: boolean;
  earHint: boolean;
  modelLoading: string | null;
}

/** Status pill, live guidance and the face-alignment guide shown while searching. */
export function TrackingOverlay({ overlayControls, snapshot, source, needsBody, earHint, modelLoading }: Props) {
  const { status, faceVisible, framing, bodySource, fps } = snapshot;
  const searching = status === 'searching' || (status === 'loading' && source === 'camera');

  let hint: string | null = null;
  if (status === 'loading') hint = 'Preparing face tracking…';
  else if (status === 'error') hint = snapshot.error ?? 'Face tracking is unavailable on this device.';
  else if (!faceVisible)
    hint = source === 'photo' ? 'No face found. Try a clear, front-facing photo in good light.' : 'Face the camera in good, even light';
  else if (source === 'camera' && framing === 'too-far') hint = 'Move a little closer';
  else if (source === 'camera' && framing === 'too-close') hint = 'Move back a little so your whole face fits';
  else if (source === 'camera' && framing === 'off-centre') hint = 'Centre your face in the frame';
  else if (needsBody && bodySource === 'estimated')
    hint = source === 'camera' ? 'Step back a little so your shoulders are visible' : 'For the best necklace fit, use a photo that shows your shoulders';
  else if (earHint) hint = 'Tuck your hair behind your ears for the best fit';

  return (
    <>
      {/* status pill */}
      <div className="pointer-events-none absolute top-3 left-3 z-20 flex items-center gap-2 sm:top-4 sm:left-4">
        <div className="glass flex items-center gap-2 rounded-full py-1.5 pr-3 pl-2 text-[11.5px] font-semibold">
          {source === 'camera' ? (
            <span className="flex items-center gap-1.5 rounded-full bg-rose px-2 py-0.5 text-[10px] tracking-[0.14em] text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> LIVE
            </span>
          ) : (
            <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] tracking-[0.14em] text-ivory">PHOTO</span>
          )}
          {status === 'loading' ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading tracker
            </span>
          ) : faceVisible ? (
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Face tracked
              {source === 'camera' && fps > 0 && <span className="font-medium text-muted">· {fps} fps</span>}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-cocoa">
              <ScanFace className="h-3.5 w-3.5" /> Looking for face
            </span>
          )}
        </div>
      </div>

      {/* alignment guide (Lenskart-style setup frame) */}
      <AnimatePresence>
        {searching && source === 'camera' && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
          >
            <div className="relative h-[62%] max-h-[420px] aspect-[3/4] overflow-hidden rounded-[50%] border-2 border-white shadow-[0_0_0_9999px_rgba(246,241,232,0.55)]">
              <div className="scan-line absolute inset-x-0 top-0 h-1/4" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* loading chip when switching jewellery */}
      <AnimatePresence>
        {modelLoading && (
          <motion.div
            className="pointer-events-none absolute top-3 right-14 z-20 sm:top-4 sm:right-16"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            <div className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold">
              <Sparkles className="h-3.5 w-3.5 animate-pulse text-gold" />
              <span className="max-w-[40vw] truncate">{modelLoading}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* guidance */}
      <div className={`pointer-events-none absolute inset-x-0 z-20 flex justify-center px-4 ${overlayControls ? 'bottom-[236px] sm:bottom-[250px]' : 'bottom-4'}`}>
        <AnimatePresence mode="wait">
          {hint && (
            <motion.p
              key={hint}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="glass rounded-full px-4 py-2 text-center text-[12.5px] font-medium"
              role="status"
            >
              {hint}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
