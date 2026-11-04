import { motion } from 'motion/react';
import { AlertCircle, Camera, ImageUp, Loader2, Lock, Sun, Glasses, Ear } from 'lucide-react';
import { CAMERA_ERROR_COPY, type CameraErrorKind } from '../../hooks/useCamera';

interface Props {
  requesting: boolean;
  error?: CameraErrorKind;
  photoError?: string | null;
  dragging: boolean;
  onCamera: () => void;
  onUpload: () => void;
}

/** Shown before a source is chosen, while awaiting permission, or after an error. */
export function IdleState({ requesting, error, photoError, dragging, onCamera, onUpload }: Props) {
  const err = error ? CAMERA_ERROR_COPY[error] : null;
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center overflow-y-auto bg-[radial-gradient(ellipse_at_50%_18%,#ffffff_0%,#f7f1e7_55%,#ece3d4_100%)] p-5 text-ink">
      <div
        className={`pointer-events-none absolute inset-3 rounded-xl border-2 border-dashed transition-colors duration-300 ${
          dragging ? 'border-gold bg-champagne/15' : 'border-transparent'
        }`}
      />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-lg text-center"
      >
        {requesting ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-champagne" />
            <p className="font-display text-2xl">Waiting for camera permission…</p>
            <p className="text-sm text-muted">Choose “Allow” in your browser prompt to continue.</p>
          </div>
        ) : (
          <>
            {err || photoError ? (
              <div className="mx-auto mb-6 flex max-w-md items-start gap-3 rounded-lg border border-danger/25 bg-[#fbefed] p-4 text-left">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
                <div>
                  <p className="text-sm font-semibold">{err?.title ?? 'That photo did not work'}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-cocoa">{err?.body ?? photoError}</p>
                </div>
              </div>
            ) : (
              <>
                <p className="eyebrow">3D Virtual Try-On</p>
                <h3 className="mt-3 font-display text-[34px] leading-[1.05] font-medium sm:text-[42px]">
                  See it on you, <em className="text-gold">before</em> you buy
                </h3>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-cocoa">
                  The jewellery follows your face as you move. Turn your head to see how it catches the light.
                </p>
              </>
            )}
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <button
                onClick={onCamera}
                className="group flex items-center gap-3.5 rounded-lg bg-ink p-4 text-left text-ivory shadow-lift transition-transform duration-300 hover:-translate-y-0.5"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white/10 text-champagne-soft transition-colors group-hover:bg-gold-deep">
                  <Camera className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-[15px] font-bold">{err ? 'Try camera again' : 'Live camera'}</span>
                  <span className="block text-xs text-ivory/65">Real-time 3D tracking</span>
                </span>
              </button>
              <button
                onClick={onUpload}
                className="group flex items-center gap-3.5 rounded-lg border border-line bg-white p-4 text-left shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-champagne"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-cream text-gold-deep">
                  <ImageUp className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-[15px] font-bold">Upload a photo</span>
                  <span className="block text-xs text-muted">or drop an image here</span>
                </span>
              </button>
            </div>
            <ul className="mt-7 hidden items-center justify-center gap-5 text-[11.5px] text-muted sm:flex">
              <li className="flex items-center gap-1.5">
                <Sun className="h-3.5 w-3.5 text-champagne" /> Face the light
              </li>
              <li className="flex items-center gap-1.5">
                <Ear className="h-3.5 w-3.5 text-champagne" /> Hair behind ears
              </li>
              <li className="flex items-center gap-1.5">
                <Glasses className="h-3.5 w-3.5 text-champagne" /> Remove glasses
              </li>
            </ul>
            <p className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-muted">
              <Lock className="h-3 w-3" /> Processed on your device. Nothing is uploaded.
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
