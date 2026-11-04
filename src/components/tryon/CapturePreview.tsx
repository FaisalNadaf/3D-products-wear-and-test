import { AnimatePresence, motion } from 'motion/react';
import { Download, RefreshCw, Share2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export interface CaptureResult {
  url: string;
  blob: Blob;
  width: number;
  height: number;
  fileName: string;
  productName: string;
}

interface Props {
  capture: CaptureResult | null;
  onClose: () => void;
  onRetake: () => void;
}

export function CapturePreview({ capture, onClose, onRetake }: Props) {
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    if (!capture) return;
    try {
      const file = new File([capture.blob], capture.fileName, { type: capture.blob.type });
      setCanShare(!!navigator.canShare?.({ files: [file] }));
    } catch {
      setCanShare(false);
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [capture, onClose]);

  const download = () => {
    if (!capture) return;
    const a = document.createElement('a');
    a.href = capture.url;
    a.download = capture.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const share = async () => {
    if (!capture) return;
    const file = new File([capture.blob], capture.fileName, { type: capture.blob.type });
    try {
      await navigator.share({ files: [file], title: `My look in ${capture.productName}` });
    } catch {
      /* user cancelled */
    }
  };

  return (
    <AnimatePresence>
      {capture && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-ink/70 backdrop-blur-md" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Captured try-on photo"
            className="relative flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-[28px] bg-ivory shadow-lift"
            initial={{ scale: 0.94, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 10, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <div>
                <p className="eyebrow">Your look</p>
                <h2 className="font-display text-2xl font-semibold">{capture.productName}</h2>
              </div>
              <button onClick={onClose} className="rounded-full p-2 text-muted hover:bg-pearl" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 px-4 sm:px-6">
              <img
                src={capture.url}
                alt={`Try-on photo wearing ${capture.productName}`}
                className="mx-auto max-h-[62vh] w-auto rounded-2xl object-contain shadow-soft"
              />
            </div>
            <div className="flex flex-col gap-2.5 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted">
                {capture.width} × {capture.height}px PNG · saved only to your device
              </p>
              <div className="flex gap-2">
                <button onClick={onRetake} className="btn-ghost flex-1 sm:flex-none">
                  <RefreshCw className="h-4 w-4" /> Retake
                </button>
                {canShare && (
                  <button onClick={share} className="btn-ghost flex-1 sm:flex-none">
                    <Share2 className="h-4 w-4" /> Share
                  </button>
                )}
                <button onClick={download} className="btn-primary flex-1 sm:flex-none">
                  <Download className="h-4 w-4" /> Download
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
