import { AnimatePresence, motion } from 'motion/react';
import { Camera, CameraOff, ImageUp, Maximize2, Minimize2, Palette, RotateCcw, Shuffle, SlidersHorizontal } from 'lucide-react';
import type { Fit } from '../../lib/three/JewelStage';

interface Props {
  /** overlay: floating bar over the feed (fullscreen); dock: light bar under the stage */
  placement: 'overlay' | 'dock';
  source: 'camera' | 'photo';
  canCapture: boolean;
  capturing: boolean;
  isFullscreen: boolean;
  fit: Fit;
  fitOpen: boolean;
  bgActive: boolean;
  bgOpen: boolean;
  onBackground: () => void;
  onFitOpen: (open: boolean) => void;
  onFit: (fit: Fit) => void;
  onStartCamera: () => void;
  onStopCamera: () => void;
  onUpload: () => void;
  onCapture: () => void;
  onSwitch: () => void;
  onReset: () => void;
  onFullscreen: () => void;
}

/** Try-on control bar: source, switch, capture, background, fit, reset, fullscreen. */
export function TryOnControls(p: Props) {
  const live = p.source === 'camera';
  const dock = p.placement === 'dock';
  return (
    <>
      <button
        onClick={p.onFullscreen}
        className="absolute top-3 right-3 z-30 flex h-10 w-10 items-center justify-center rounded-md border border-white/40 bg-white/85 text-ink shadow-sm backdrop-blur transition-colors hover:bg-white sm:top-4 sm:right-4"
        aria-label={p.isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        title={p.isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
      >
        {p.isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>

      <AnimatePresence>
        {p.fitOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-[88px] left-1/2 z-40 w-[min(320px,calc(100%-24px))] -translate-x-1/2 rounded-xl border border-line bg-white/97 p-4 shadow-lift backdrop-blur"
            role="dialog"
            aria-label="Adjust fit"
          >
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-semibold text-ink">Adjust fit</p>
              <button className="text-[12px] font-semibold text-gold-deep hover:text-ink" onClick={() => p.onFit({ scale: 1, lift: 0 })}>
                Reset
              </button>
            </div>
            <label className="mt-3 block text-[12px] text-cocoa">
              Size · {Math.round(p.fit.scale * 100)}%
              <input type="range" className="lux-range mt-2" min={0.75} max={1.3} step={0.01} value={p.fit.scale} onChange={(e) => p.onFit({ ...p.fit, scale: +e.target.value })} />
            </label>
            <label className="mt-3 block text-[12px] text-cocoa">
              Position · {p.fit.lift > 0 ? '+' : ''}
              {p.fit.lift.toFixed(1)} cm
              <input type="range" className="lux-range mt-2" min={-2} max={2} step={0.05} value={p.fit.lift} onChange={(e) => p.onFit({ ...p.fit, lift: +e.target.value })} />
            </label>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={
          dock
            ? 'relative z-30 flex h-[76px] items-center justify-center border-t border-line bg-white px-2'
            : 'absolute inset-x-0 bottom-3 z-30 flex justify-center px-3 sm:bottom-4'
        }
      >
        <div className={`flex items-center gap-0.5 sm:gap-1 ${dock ? '' : 'rounded-full border border-white/50 bg-white/88 p-1.5 shadow-glass backdrop-blur'}`}>
          {live ? (
            <Ctl label="Stop camera" onClick={p.onStopCamera}>
              <CameraOff className="h-[18px] w-[18px]" />
            </Ctl>
          ) : (
            <Ctl label="Use camera" onClick={p.onStartCamera}>
              <Camera className="h-[18px] w-[18px]" />
            </Ctl>
          )}
          <Ctl label="Upload photo" onClick={p.onUpload}>
            <ImageUp className="h-[18px] w-[18px]" />
          </Ctl>
          <Ctl label="Switch jewellery" onClick={p.onSwitch}>
            <Shuffle className="h-[18px] w-[18px]" />
          </Ctl>

          <button
            onClick={p.onCapture}
            disabled={!p.canCapture || p.capturing}
            aria-label="Capture photo"
            title="Capture photo"
            className="group relative mx-1.5 flex h-14 w-14 items-center justify-center rounded-full disabled:opacity-40"
          >
            <span className="absolute inset-0 rounded-full border-[3px] border-ink" />
            <span className={`h-10.5 w-10.5 rounded-full bg-linear-to-b from-[#d6b97f] to-[#ad8845] transition-transform duration-300 group-hover:scale-95 group-active:scale-85 ${p.capturing ? 'scale-75' : ''}`} />
          </button>

          <Ctl label="Background" active={p.bgOpen || p.bgActive} onClick={p.onBackground}>
            <Palette className="h-[18px] w-[18px]" />
          </Ctl>
          <Ctl label="Adjust fit" active={p.fitOpen} onClick={() => p.onFitOpen(!p.fitOpen)}>
            <SlidersHorizontal className="h-[18px] w-[18px]" />
          </Ctl>
          <Ctl label="Reset" onClick={p.onReset}>
            <RotateCcw className="h-[18px] w-[18px]" />
          </Ctl>
        </div>
      </div>
    </>
  );
}

function Ctl({ children, label, onClick, active }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-md text-ink transition-colors ${active ? 'bg-ink text-ivory' : 'hover:bg-cream'}`}
    >
      {children}
    </button>
  );
}
