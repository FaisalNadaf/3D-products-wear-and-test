import { useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ImagePlus, Loader2, RotateCcw, X } from 'lucide-react';
import { BACKGROUNDS, type BackgroundOption } from '../../config/backgrounds';

interface Props {
  open: boolean;
  value: string;
  customUrl: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  onChange: (id: string) => void;
  onUpload: (file: File) => void;
  onClose: () => void;
}

const GROUPS: BackgroundOption['group'][] = ['Original', 'Colours', 'Luxury studio', 'Interiors'];

/** Background picker: swaps the room behind the wearer instantly. */
export function BackgroundPanel({ open, value, customUrl, status, onChange, onUpload, onClose }: Props) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="absolute right-3 bottom-[88px] z-40 flex max-h-[calc(100%-100px)] w-[min(360px,calc(100%-24px))] flex-col rounded-xl border border-line bg-white/97 p-4 shadow-lift backdrop-blur sm:right-4"
          role="dialog"
          aria-label="Background"
        >
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-semibold text-ink">Background</p>
            <div className="flex items-center gap-1">
              {status === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-gold" aria-label="Preparing segmentation" />}
              <button className="rounded-md p-1.5 text-muted hover:bg-cream hover:text-ink" onClick={() => onChange('original')} title="Reset to original" aria-label="Reset to original background">
                <RotateCcw className="h-4 w-4" />
              </button>
              <button className="rounded-md p-1.5 text-muted hover:bg-cream hover:text-ink" onClick={onClose} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          {status === 'error' && <p className="mt-2 text-[12px] text-danger">Background replacement isn’t available on this device.</p>}
          <div className="scrollbar-thin mt-2 min-h-0 flex-1 space-y-3.5 overflow-y-auto pr-1">
            {GROUPS.map((g) => (
              <div key={g}>
                <p className="label mb-2">{g}</p>
                <div className="grid grid-cols-4 gap-2">
                  {BACKGROUNDS.filter((b) => b.group === g).map((b) => (
                    <Swatch key={b.id} label={b.label} preview={b.preview} selected={value === b.id} onClick={() => onChange(b.id)} />
                  ))}
                </div>
              </div>
            ))}
            <div>
              <p className="label mb-2">Yours</p>
              <div className="grid grid-cols-4 gap-2">
                {customUrl && (
                  <Swatch label="Uploaded" preview={`center/cover url(${customUrl})`} selected={value === 'custom'} onClick={() => onChange('custom')} />
                )}
                <button
                  onClick={() => input.current?.click()}
                  className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-dashed border-champagne text-[10.5px] font-semibold text-gold-deep transition-colors hover:bg-cream"
                >
                  <ImagePlus className="h-4 w-4" /> Upload
                </button>
              </div>
              <input
                ref={input}
                type="file"
                accept="image/*"
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpload(f);
                  e.target.value = '';
                }}
              />
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">Person segmentation runs on your device. Tracking continues while you switch.</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Swatch({ label, preview, selected, onClick }: { label: string; preview: string; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group text-left" aria-pressed={selected} title={label}>
      <span
        className={`relative block aspect-square overflow-hidden rounded-md border transition-all ${selected ? 'border-ink ring-2 ring-ink/15' : 'border-line group-hover:border-champagne'}`}
        style={{ background: preview }}
      >
        {selected && (
          <span className="absolute right-1 bottom-1 flex h-4 w-4 items-center justify-center rounded-full bg-ink text-white">
            <Check className="h-2.5 w-2.5" strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="mt-1 block truncate text-[10.5px] font-medium text-cocoa">{label}</span>
    </button>
  );
}
