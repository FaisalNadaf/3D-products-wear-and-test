import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Download, ImageUp, Loader2, MousePointerClick, MoveHorizontal, RotateCcw, SlidersHorizontal, SquareDashed, X } from 'lucide-react';
import { Seo } from '../components/site/Seo';
import { useElementSize, fitMedia } from '../hooks/useElementSize';
import { formatPrice } from '../config/catalog';
import { COLOR_NAMES, CURTAINS, CURTAIN_COLORS, SAMPLE_ROOMS, WEAVES, settingsFor, type CurtainSettings, type CurtainStyle } from '../config/curtains';
import { CurtainEngine, poseFromQuad } from '../features/curtains/CurtainEngine';
import { defaultQuad, detectWindowAt, detectWindowAuto, type Quad } from '../features/curtains/windowDetect';

type Compare = 'before' | 'split' | 'after';
type TapTarget = 'window' | 'object' | null;

const MAX_SIDE = 2400;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif'];
const THUMB = (id: string) => `${import.meta.env.BASE_URL}curtains/${id}.webp`;
const weaveLabel = (c: CurtainStyle) => WEAVES.find((w) => w.id === c.weave)?.label ?? c.type;
const isBlind = (c: CurtainStyle) => c.header === 'roman' || c.header === 'roller';

interface Room {
  img: HTMLCanvasElement;
  url: string;
  w: number;
  h: number;
  /** sample room id; null for a customer's own photo */
  sample: string | null;
}

async function loadRoom(src: string | File, sample: string | null): Promise<Room> {
  let bitmap: ImageBitmap;
  if (typeof src === 'string') {
    const res = await fetch(src);
    if (!res.ok) throw new Error('The sample room could not be loaded. Please check your connection and try again.');
    bitmap = await createImageBitmap(await res.blob());
  } else {
    if (src.type && !ACCEPTED.includes(src.type)) throw new Error('That file type is not supported. Please choose a JPG, PNG or WebP photo.');
    if (src.size > 25 * 1024 * 1024) throw new Error('That photo is larger than 25 MB. Please choose a smaller one.');
    try {
      bitmap = await createImageBitmap(src, { imageOrientation: 'from-image' });
    } catch {
      throw new Error(
        src.type.includes('hei')
          ? 'This browser cannot open HEIC photos. Please save the photo as a JPG and try again.'
          : 'That file could not be opened as a photo. Please choose a JPG, PNG or WebP image.',
      );
    }
    if (Math.max(bitmap.width, bitmap.height) < 480) {
      bitmap.close();
      throw new Error('That photo is too small to preview well. Please use one at least 480 pixels wide.');
    }
  }
  const k = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(bitmap.width * k), height: Math.round(bitmap.height * k) });
  c.getContext('2d')!.drawImage(bitmap, 0, 0, c.width, c.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.92));
  return { img: c, url: blob ? URL.createObjectURL(blob) : c.toDataURL(), w: c.width, h: c.height, sample };
}

export default function CurtainVisualizer() {
  const [room, setRoom] = useState<Room | null>(null);
  const [quad, setQuad] = useState<Quad>(defaultQuad());
  const [curtain, setCurtain] = useState<CurtainStyle | null>(null);
  const [settings, setSettings] = useState<CurtainSettings>(() => settingsFor(CURTAINS[2]));
  const [view, setView] = useState<Compare>('before');
  const [split, setSplit] = useState(50);
  const [placing, setPlacing] = useState(false);
  const [adjust, setAdjust] = useState(false);
  const [tap, setTap] = useState<TapTarget>(null);
  const [hasObjects, setHasObjects] = useState(false);
  const [busy, setBusy] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canvas = useRef<HTMLCanvasElement>(null);
  const fg = useRef<HTMLCanvasElement>(null);
  const flash = useRef<HTMLCanvasElement>(null);
  const mask = useRef<HTMLCanvasElement | null>(null);
  const engine = useRef<CurtainEngine | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const roomRef = useRef<Room | null>(null);
  const boxSize = useElementSize(box);
  const layer = fitMedia(boxSize, room ? { width: room.w, height: room.h } : { width: 3, height: 2 }, 'contain');

  // engine lifetime
  useEffect(() => {
    if (!canvas.current) return;
    try {
      engine.current = new CurtainEngine(canvas.current);
    } catch {
      setError('This browser cannot draw the 3D curtains because WebGL is unavailable. Please try a recent version of Chrome, Safari or Edge.');
    }
    return () => {
      engine.current?.dispose();
      engine.current = null;
      if (roomRef.current) URL.revokeObjectURL(roomRef.current.url);
    };
  }, []);
  useEffect(() => {
    if (layer.width && engine.current) engine.current.resize(layer.width, layer.height);
  }, [layer.width, layer.height]);

  // geometry is rebuilt at most once per frame, however fast a slider or corner moves
  const frame = useRef(0);
  useEffect(() => {
    if (!room) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const e = engine.current;
      if (!e) return;
      e.setWindow(quad);
      e.update(settings);
      e.setVisible(!!curtain);
    });
    return () => cancelAnimationFrame(frame.current);
  }, [quad, settings, room, curtain, layer.width]);

  const paintObjects = useCallback((r: Room) => {
    const c = fg.current;
    const m = mask.current;
    if (!c || !m) return;
    c.width = r.w;
    c.height = r.h;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(r.img, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(m, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }, []);

  const clearObjects = (r: Room | null = room) => {
    if (mask.current) mask.current.getContext('2d')!.clearRect(0, 0, mask.current.width, mask.current.height);
    if (r) paintObjects(r);
    setHasObjects(false);
  };

  /** Loads a sample (with measured corners) or a customer's photo (which then needs marking). */
  const openRoom = async (src: string | File, sampleId: string | null) => {
    setError(null);
    setNote(null);
    setBusy(true);
    setTap(null);
    try {
      const r = await loadRoom(src, sampleId);
      if (roomRef.current) URL.revokeObjectURL(roomRef.current.url);
      roomRef.current = r;
      setRoom(r);
      mask.current = Object.assign(document.createElement('canvas'), { width: r.w, height: r.h });
      clearObjects(r);
      engine.current?.setPhoto(r.img, r.w, r.h);
      const sample = SAMPLE_ROOMS.find((s) => s.id === sampleId);
      const q = (sample ? sample.quad : (detectWindowAuto(r.img, r.w, r.h) ?? defaultQuad())) as Quad;
      setQuad(q);
      // distance to the floor comes from the photo: measured for samples, estimated otherwise
      const pose = poseFromQuad(q, r.w, r.h);
      const top = (q[0][1] + q[1][1]) / 2;
      const bottom = (q[2][1] + q[3][1]) / 2;
      const ratio = sample ? (sample.floorY - bottom) / Math.max(0.01, bottom - top) : 0.75;
      const floor = Math.min(2, Math.max(0.1, ratio * pose.aspect * 1.2));
      setSettings((s) => ({ ...s, floor, drop: floor, mount: sample?.mount ?? 0.14, extend: sample?.extend ?? 0.26 }));
      setPlacing(!sample);
      setAdjust(false);
    } catch (e) {
      setError((e as Error).message || 'That photo could not be opened.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const first = SAMPLE_ROOMS[0];
    void openRoom(first.src, first.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** A quick cross-fade from the last frame, so swapping curtains feels continuous. */
  const crossFade = () => {
    const src = canvas.current;
    const c = flash.current;
    if (!src || !c || !curtain || view === 'before') return;
    c.width = src.width;
    c.height = src.height;
    c.getContext('2d')!.drawImage(src, 0, 0);
    c.getAnimations().forEach((a) => a.cancel());
    c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: 'ease-out' });
  };

  const pickCurtain = (c: CurtainStyle) => {
    crossFade();
    setCurtain(c);
    setSettings((s) => settingsFor(c, s));
    if (view === 'before') setView('after');
    setPlacing(false);
  };
  const pickColor = (color: string) => {
    crossFade();
    setSettings((s) => ({ ...s, color }));
  };
  const set = <K extends keyof CurtainSettings>(k: K, v: CurtainSettings[K]) => setSettings((s) => ({ ...s, [k]: v }));

  const startOver = () => {
    setCurtain(null);
    setView('before');
    setSplit(50);
    setSettings(settingsFor(CURTAINS[2]));
    const first = SAMPLE_ROOMS[0];
    void openRoom(first.src, first.id);
  };

  const onStageTap = async (e: React.MouseEvent) => {
    if (!tap || !room) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const target = tap;
    setTap(null);
    setBusy(true);
    setNote(null);
    try {
      const res = await detectWindowAt(room.img, x, y);
      if (target === 'window') {
        if (res.quad) setQuad(res.quad);
        else setNote('We could not outline a window there. Try tapping the glass, or drag the corners by hand.');
      } else {
        const m = mask.current!;
        const tmp = Object.assign(document.createElement('canvas'), { width: res.w, height: res.h });
        const tctx = tmp.getContext('2d')!;
        const id = tctx.createImageData(res.w, res.h);
        for (let i = 0; i < res.w * res.h; i++) id.data[i * 4 + 3] = res.mask[i] * 255;
        tctx.putImageData(id, 0, 0);
        m.getContext('2d')!.drawImage(tmp, 0, 0, m.width, m.height);
        paintObjects(room);
        setHasObjects(true);
      }
    } catch (err) {
      console.error(err);
      setNote('Automatic outlining is not available on this device. You can still drag the corners by hand.');
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    const e = engine.current;
    if (!e || !room || !curtain) return;
    const out = e.capture();
    if (fg.current && hasObjects) out.getContext('2d')!.drawImage(fg.current, 0, 0, out.width, out.height);
    const a = document.createElement('a');
    a.href = out.toDataURL('image/jpeg', 0.92);
    a.download = `curtains-${curtain.id}.jpg`;
    a.click();
  };

  const moveSplit = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    setSplit(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
  };

  const blind = curtain ? isBlind(curtain) : false;
  const markBar = (
    <div className="flex items-center gap-2">
      <p className="min-w-0 flex-1 pl-1 text-[13px] leading-snug font-medium text-ink">Drag the corners onto your window</p>
      <button onClick={() => setTap(tap === 'window' ? null : 'window')} aria-pressed={tap === 'window'} className="btn-ghost min-h-10 shrink-0 px-2.5 text-[13px]">
        <MousePointerClick className="h-4 w-4" /> Find it
      </button>
      <button onClick={() => setPlacing(false)} className="btn-primary min-h-10 shrink-0 px-4 text-[13px]">Done</button>
    </div>
  );
  const hint = tap === 'window' ? 'Tap the glass of your window' : tap === 'object' ? 'Tap the object that stands in front of the curtains' : null;

  return (
    <>
      <Seo title="Curtain Visualizer" description="See how curtains will look on your window. Use our sample room or a photo of your own, choose a curtain and compare before and after." path="/curtains" />

      <div className="container-lux pt-4 pb-3 sm:pt-6 lg:flex lg:items-baseline lg:justify-between lg:gap-8">
        <h1 className="display text-[30px] leading-tight sm:text-[38px]">See curtains on your window</h1>
        <p className="mt-1 text-[14px] text-cocoa lg:mt-0">Your photo stays on your device. Nothing is uploaded.</p>
      </div>

      <section className="container-lux grid grid-cols-[minmax(0,1fr)] gap-5 pb-16 lg:h-[max(640px,calc(100svh-152px))] lg:grid-cols-[minmax(0,1fr)_348px] lg:pb-10">
        {/* ─── the room ─── */}
        <div className="sticky top-16 z-20 -mx-4 bg-ivory px-4 pb-2 sm:mx-0 sm:px-0 lg:static lg:m-0 lg:h-full lg:p-0">
          <div ref={box} className="relative max-h-[46svh] w-full lg:h-full lg:max-h-none lg:[aspect-ratio:auto]!" style={{ aspectRatio: room ? room.w / room.h : 1.5 }}>
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg bg-pearl shadow-soft lg:top-0 lg:translate-y-0"
              style={{ width: layer.width, height: layer.height, cursor: tap ? 'crosshair' : undefined }}
              onClick={onStageTap}
            >
              {!room && <img src={SAMPLE_ROOMS[0].thumb} alt="" className="absolute inset-0 h-full w-full scale-105 object-cover blur-sm" />}
              <canvas ref={canvas} className="absolute inset-0 h-full w-full" role="img" aria-label={curtain ? `Room with ${curtain.name}` : 'Room with a bare window'} />
              <canvas ref={fg} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />
              <canvas ref={flash} className="pointer-events-none absolute inset-0 h-full w-full opacity-0" aria-hidden />

              {/* the unchanged photo: covers the render for "before", half of it for the slider */}
              {room && (
                <img
                  src={room.url}
                  alt=""
                  className="pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-500"
                  style={{
                    opacity: view === 'after' && curtain ? 0 : 1,
                    clipPath: view === 'split' && curtain ? `inset(0 ${100 - split}% 0 0)` : undefined,
                  }}
                />
              )}

              {view === 'split' && curtain && !placing && (
                <div className="absolute inset-0 cursor-ew-resize touch-none" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); moveSplit(e); }} onPointerMove={(e) => e.buttons && moveSplit(e)}>
                  <div className="pointer-events-none absolute inset-y-0 w-px bg-white shadow-[0_0_6px_rgba(0,0,0,.35)]" style={{ left: `${split}%` }}>
                    <span className="absolute top-1/2 left-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow-lift">
                      <MoveHorizontal className="h-4 w-4" />
                    </span>
                  </div>
                  <span className="pointer-events-none absolute top-3 left-3 rounded-xs bg-white/90 px-2 py-1 text-[11px] font-semibold text-ink">Before</span>
                  <span className="pointer-events-none absolute top-3 right-3 rounded-xs bg-white/90 px-2 py-1 text-[11px] font-semibold text-ink">After</span>
                  <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(+e.target.value)} aria-label="Compare before and after" className="sr-only" />
                </div>
              )}

              {placing && <WindowFrame quad={quad} onChange={setQuad} disabled={!!tap} />}

            {/* guidance */}
            <AnimatePresence>
              {!busy && !curtain && !placing && !error && (
                <motion.p key="choose" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-white/95 px-3.5 py-2 text-[13px] font-medium text-ink shadow-soft">
                  Choose a curtain to see it on this window
                </motion.p>
              )}
              {hint && (
                <motion.p key="tap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-3.5 py-2 text-[13px] font-medium text-ivory">
                  {hint}
                </motion.p>
              )}
            </AnimatePresence>

            {/* before / after */}
            {curtain && !placing && (
              <div role="group" aria-label="Before and after" onClick={(e) => e.stopPropagation()} className="absolute bottom-3 left-1/2 flex -translate-x-1/2 rounded-md bg-white/95 p-1 shadow-soft">
                {(['before', 'split', 'after'] as Compare[]).map((v) => (
                  <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={`min-h-8 rounded-sm px-3 text-[12.5px] font-semibold capitalize transition-colors sm:min-h-9 sm:px-4 sm:text-[13px] ${view === v ? 'bg-ink text-ivory' : 'text-cocoa hover:text-ink'}`}>
                    {v === 'split' ? 'Compare' : v}
                  </button>
                ))}
              </div>
            )}

            {/* marking the window */}
            {placing && (
              <motion.div onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="absolute inset-x-3 bottom-3 mx-auto hidden max-w-[520px] rounded-md bg-white/95 p-2.5 shadow-soft sm:block">
                {markBar}
              </motion.div>
            )}

            {busy && (
              <div className="absolute top-3 right-3 flex items-center gap-2 rounded-md bg-white/95 px-3 py-2 text-[12.5px] font-medium text-ink shadow-soft" role="status">
                <Loader2 className="h-4 w-4 animate-spin text-gold" /> Preparing
              </div>
            )}
            {(error || note) && (
              <div role="alert" className={`absolute inset-x-3 top-3 mx-auto flex max-w-[560px] items-start gap-2 rounded-md border bg-white p-3 text-[13px] shadow-soft ${error ? 'border-danger/30 text-danger' : 'border-line text-cocoa'}`}>
                <span className="flex-1">{error ?? note}</span>
                <button onClick={() => { setError(null); setNote(null); }} aria-label="Dismiss" className="-m-1 rounded-sm p-1 hover:bg-cream"><X className="h-4 w-4" /></button>
              </div>
            )}
            </div>
          </div>
          {/* on phones the instructions sit under the photo so they never cover the window */}
          {placing && <div className="mt-2 rounded-md border border-line bg-white p-2 sm:hidden">{markBar}</div>}
        </div>

        {/* ─── the three steps ─── */}
        <aside className="flex min-h-0 min-w-0 flex-col gap-5 lg:h-full">
          <Step n={1} title="Choose your room" aside={<button onClick={startOver} className="flex items-center gap-1 rounded-xs text-[12px] font-medium text-muted transition-colors hover:text-ink"><RotateCcw className="h-3 w-3" /> Start again</button>}>
            <div className="grid grid-cols-4 gap-1.5">
              {SAMPLE_ROOMS.map((r) => (
                <button key={r.id} onClick={() => void openRoom(r.src, r.id)} aria-pressed={room?.sample === r.id} aria-label={r.label} title={r.label} className={`overflow-hidden rounded-sm border-2 transition-colors ${room?.sample === r.id ? 'border-ink' : 'border-transparent hover:border-champagne'}`}>
                  <img src={r.thumb} alt="" width={160} height={107} loading="lazy" className="aspect-[3/2] w-full object-cover" />
                </button>
              ))}
            </div>
            <button onClick={() => file.current?.click()} className={`${room && !room.sample ? 'btn-primary' : 'btn-ghost'} mt-2 min-h-11 w-full text-[13.5px]`}>
              <ImageUp className="h-4 w-4" /> {room && !room.sample ? 'Use a different photo' : 'Upload your room'}
            </button>
            <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/heic,.heic" className="sr-only" tabIndex={-1} aria-label="Upload a photo of your room" onChange={(e) => { const f = e.target.files?.[0]; if (f) void openRoom(f, null); e.target.value = ''; }} />
          </Step>

          <Step n={2} title="Select your curtains" grow={!adjust}>
            {adjust && curtain ? (
              <button onClick={() => setAdjust(false)} className="flex w-full items-center gap-2.5 rounded-md border border-line bg-white p-1.5 text-left hover:border-champagne">
                <img src={THUMB(curtain.id)} alt="" className="h-10 w-10 rounded-xs object-cover" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{curtain.name}</span>
                <span className="pr-2 text-[12px] text-muted">Change</span>
              </button>
            ) : (
              <div className="scrollbar-thin flex min-h-0 flex-1 gap-2.5 overflow-x-auto pb-1 lg:grid lg:grid-cols-2 lg:content-start lg:overflow-x-hidden lg:overflow-y-auto lg:pr-1 lg:pb-0">
                {CURTAINS.map((c) => (
                  <button key={c.id} onClick={() => pickCurtain(c)} aria-pressed={curtain?.id === c.id} className="group w-[136px] shrink-0 text-left lg:w-auto">
                    <span className={`block overflow-hidden rounded-sm border-2 transition-colors ${curtain?.id === c.id ? 'border-ink' : 'border-transparent group-hover:border-champagne'}`}>
                      <img src={THUMB(c.id)} alt="" width={320} height={200} loading="lazy" className="aspect-[8/5] w-full bg-pearl object-cover object-top" />
                    </span>
                    <span className="mt-1.5 block truncate text-[12.5px] font-semibold text-ink">{c.name}</span>
                    <span className="block truncate text-[11.5px] text-muted">{weaveLabel(c)} · {COLOR_NAMES[c.color] ?? 'Custom'}</span>
                    <span className="block text-[12px] font-semibold text-gold-deep">{formatPrice(c.price)}</span>
                  </button>
                ))}
              </div>
            )}
            {curtain && (
              <div className="mt-3 border-t border-line-soft pt-3">
                <p className="text-[12px] text-cocoa">Colour: <span className="font-semibold text-ink">{COLOR_NAMES[settings.color] ?? 'Custom'}</span></p>
                <div className="scrollbar-none mt-1.5 flex gap-1.5 overflow-x-auto p-1">
                  {[...new Set([curtain.color, ...CURTAIN_COLORS])].map((c) => (
                    <button key={c} onClick={() => pickColor(c)} aria-label={COLOR_NAMES[c] ?? c} title={COLOR_NAMES[c] ?? c} aria-pressed={settings.color === c} className={`h-6 w-6 shrink-0 rounded-full border border-black/10 outline-offset-2 transition-transform hover:scale-110 ${settings.color === c ? 'outline-2 outline-ink' : ''}`} style={{ background: c }} />
                  ))}
                </div>
              </div>
            )}
          </Step>

          <Step n={3} title="Preview your room">
            <AnimatePresence initial={false}>
              {adjust && curtain && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                  <div className="space-y-3 pb-3">
                    <Slider label={blind ? 'Raise the blind' : 'Open or close'} min={0} max={1} step={0.01} value={settings.open} onChange={(v) => set('open', v)} fmt={(v) => (v < 0.03 ? 'Closed' : v > 0.97 ? 'Open' : `${Math.round(v * 100)}%`)} />
                    {!blind && (
                      <>
                        <Slider label="Curtain width" min={0} max={0.6} step={0.01} value={settings.extend} onChange={(v) => set('extend', v)} fmt={(v) => `+${Math.round(v * 120)} cm each side`} />
                        <Slider label="Curtain length" min={0} max={settings.floor} step={0.01} value={Math.min(settings.drop, settings.floor)} onChange={(v) => set('drop', v)} fmt={(v) => (v >= settings.floor - 0.01 ? 'To the floor' : v < 0.03 ? 'To the sill' : `${Math.round(v * 100)} cm below sill`)} />
                        <Slider label="Height above window" min={0} max={0.5} step={0.01} value={settings.mount} onChange={(v) => set('mount', v)} fmt={(v) => `${Math.round(v * 100)} cm`} />
                      </>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => { setPlacing(true); setView('after'); }} className="btn-ghost min-h-10 px-2 text-[12.5px]"><SquareDashed className="h-4 w-4" /> Move window</button>
                      <button onClick={() => (hasObjects ? clearObjects() : setTap(tap === 'object' ? null : 'object'))} aria-pressed={tap === 'object'} className="btn-ghost min-h-10 px-2 text-[12.5px]">
                        <MousePointerClick className="h-4 w-4" /> {hasObjects ? 'Clear object' : 'Object in front'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="grid grid-cols-2 gap-2">
              <button disabled={!curtain} onClick={() => setAdjust((a) => !a)} aria-expanded={adjust} className={`${adjust ? 'btn-primary' : 'btn-ghost'} min-h-11 px-2 text-[13px] disabled:opacity-40`}>
                <SlidersHorizontal className="h-4 w-4" /> {adjust ? 'Done' : 'Adjust'}
              </button>
              <button disabled={!curtain} onClick={download} className="btn-ghost min-h-11 px-2 text-[13px] disabled:opacity-40"><Download className="h-4 w-4" /> Save image</button>
            </div>
            {curtain && (
              <Link to={`/contact?about=${encodeURIComponent(`Curtains: ${curtain.name}, ${weaveLabel(curtain)}, ${COLOR_NAMES[settings.color] ?? settings.color}`)}`} className="btn-primary mt-2 min-h-11 w-full text-[13.5px]">
                Request a quote <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </Step>
        </aside>
      </section>
    </>
  );
}

function Step({ n, title, grow, aside, children }: { n: number; title: string; grow?: boolean; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className={`flex min-w-0 flex-col ${grow ? 'lg:min-h-0 lg:flex-1' : 'shrink-0'}`} aria-label={`Step ${n}: ${title}`}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-ivory">{n}</span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Marks the window: drag a corner to resize, an edge or the middle to reposition. */
function WindowFrame({ quad, onChange, disabled }: { quad: Quad; onChange: (q: Quad) => void; disabled: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ corners: number[]; x: number; y: number; start: Quad } | null>(null);

  const begin = (e: React.PointerEvent, corners: number[]) => {
    if (disabled) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = ref.current!.getBoundingClientRect();
    drag.current = { corners, x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, start: quad };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const r = ref.current!.getBoundingClientRect();
    let dx = (e.clientX - r.left) / r.width - d.x;
    let dy = (e.clientY - r.top) / r.height - d.y;
    // keep the whole selection inside the photo
    for (const i of d.corners) {
      dx = Math.min(1 - d.start[i][0], Math.max(-d.start[i][0], dx));
      dy = Math.min(1 - d.start[i][1], Math.max(-d.start[i][1], dy));
    }
    onChange(d.start.map(([x, y], i) => (d.corners.includes(i) ? [x + dx, y + dy] : [x, y])) as Quad);
  };
  const end = () => (drag.current = null);
  const nudge = (e: React.KeyboardEvent, corners: number[]) => {
    const step = e.shiftKey ? 0.02 : 0.005;
    const dir: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const m = dir[e.key];
    if (!m) return;
    e.preventDefault();
    onChange(quad.map(([x, y], i) => (corners.includes(i) ? [Math.min(1, Math.max(0, x + m[0])), Math.min(1, Math.max(0, y + m[1]))] : [x, y])) as Quad);
  };
  const pts = quad.map(([x, y]) => `${x * 100},${y * 100}`).join(' ');
  const handles: { label: string; corners: number[]; at: [number, number]; corner: boolean }[] = [
    { label: 'Top left corner', corners: [0], at: quad[0], corner: true },
    { label: 'Top right corner', corners: [1], at: quad[1], corner: true },
    { label: 'Bottom right corner', corners: [2], at: quad[2], corner: true },
    { label: 'Bottom left corner', corners: [3], at: quad[3], corner: true },
    { label: 'Top edge', corners: [0, 1], at: [(quad[0][0] + quad[1][0]) / 2, (quad[0][1] + quad[1][1]) / 2], corner: false },
    { label: 'Right edge', corners: [1, 2], at: [(quad[1][0] + quad[2][0]) / 2, (quad[1][1] + quad[2][1]) / 2], corner: false },
    { label: 'Bottom edge', corners: [2, 3], at: [(quad[2][0] + quad[3][0]) / 2, (quad[2][1] + quad[3][1]) / 2], corner: false },
    { label: 'Left edge', corners: [3, 0], at: [(quad[3][0] + quad[0][0]) / 2, (quad[3][1] + quad[0][1]) / 2], corner: false },
  ];
  return (
    <div ref={ref} className={`absolute inset-0 ${disabled ? 'pointer-events-none' : ''}`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
        <path d={`M0 0H100V100H0Z M${quad.map(([x, y]) => `${x * 100} ${y * 100}`).join('L')}Z`} fillRule="evenodd" fill="rgba(22,26,44,.38)" />
        <polygon points={pts} fill="transparent" stroke="#fff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" className="cursor-move touch-none" style={{ pointerEvents: 'auto' }} onPointerDown={(e) => begin(e, [0, 1, 2, 3])} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
      </svg>
      {handles.map((h) => (
        <button
          key={h.label}
          aria-label={h.label}
          className="group absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-full outline-offset-[-6px] active:cursor-grabbing"
          style={{ left: `${h.at[0] * 100}%`, top: `${h.at[1] * 100}%` }}
          onPointerDown={(e) => begin(e, h.corners)}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onKeyDown={(e) => nudge(e, h.corners)}
        >
          <span className={`block rounded-full border-2 border-ink bg-white shadow-soft transition-transform group-hover:scale-125 ${h.corner ? 'h-4 w-4' : 'h-2.5 w-2.5'}`} />
        </button>
      ))}
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  return (
    <label className="block text-[12.5px] text-cocoa">
      <span className="flex justify-between gap-2">
        {label}
        <span className="font-semibold text-ink">{fmt(value)}</span>
      </span>
      <input type="range" className="lux-range mt-1.5" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </label>
  );
}
