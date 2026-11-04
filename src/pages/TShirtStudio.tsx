import '@fontsource/archivo-black';
import '@fontsource/bebas-neue';
import '@fontsource/permanent-marker';
import '@fontsource/playfair-display/700.css';
import '@fontsource/caveat/700.css';
import '@fontsource/space-mono/700.css';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  Columns2,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileJson,
  FlipHorizontal,
  ImagePlus,
  Loader2,
  Lock,
  Minus,
  Plus,
  Redo2,
  RotateCcw,
  Rotate3d,
  Save,
  Trash2,
  Type,
  Undo2,
  Unlock,
  X,
} from 'lucide-react';
import { Seo } from '../components/site/Seo';
import { useShop } from '../state/shop';
import { DEFAULT_DESIGN, FONTS, STYLE_OPTIONS, TEE_COLORS, newId, type Design, type Fabric, type Layer, type Side, type Zone } from '../features/tshirt/design';
import { TeeEngine, W, type View } from '../features/tshirt/TeeEngine';

const B = import.meta.env.BASE_URL;
const STORE = 'cubiccode.tee-designs';
const MAX_UPLOAD = 10 * 1024 * 1024;

/** Calm, flat studio colours; two photographic sets for mockups. */
const BACKDROPS = [
  { id: 'studio', label: 'Studio grey', css: '#dcd9d3', fill: '#dcd9d3' },
  { id: 'ivory', label: 'Ivory', css: '#f1ede6', fill: '#f1ede6' },
  { id: 'sand', label: 'Warm sand', css: '#e3d8c7', fill: '#e3d8c7' },
  { id: 'sage', label: 'Sage', css: '#d5dccf', fill: '#d5dccf' },
  { id: 'blush', label: 'Blush', css: '#ecdcd7', fill: '#ecdcd7' },
  { id: 'charcoal', label: 'Charcoal', css: '#2c2c2f', fill: '#2c2c2f' },
  { id: 'gallery', label: 'Gallery', css: `center/cover url(${B}backgrounds/gallery.webp)`, img: `${B}backgrounds/gallery.webp`, fill: '#ece7df' },
  { id: 'lounge', label: 'Lounge', css: `center/cover url(${B}backgrounds/lounge.webp)`, img: `${B}backgrounds/lounge.webp`, fill: '#cdb79b' },
];

const FABRIC_NOTES: Record<Fabric, string> = {
  cotton: 'Smooth, fine knit: the classic tee',
  heather: 'Marled yarn with soft colour variation',
  washed: 'Matte and lived-in, softened after sewing',
  slub: 'Irregular yarn for a natural texture',
  pique: 'Honeycomb knit used for polos',
};

/** Built-in vector graphics as data-URL SVGs. */
const svg = (s: string) => `data:image/svg+xml;utf8,${encodeURIComponent(s)}`;
const GRAPHICS = [
  { name: 'Cubiccode mark', src: `${B}brand/cube-mark.png` },
  {
    name: 'Monogram badge',
    src: svg(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><circle cx="300" cy="300" r="280" fill="none" stroke="#111" stroke-width="18"/><circle cx="300" cy="300" r="245" fill="none" stroke="#111" stroke-width="4"/><text x="300" y="350" font-family="Playfair Display,Georgia,serif" font-size="190" font-weight="700" text-anchor="middle" fill="#111">AC</text><text x="300" y="470" font-family="Archivo Black,Arial" font-size="40" letter-spacing="10" text-anchor="middle" fill="#111">EST. 2026</text></svg>`),
  },
  {
    name: 'Mountain',
    src: svg(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420"><path d="M20 400 L230 110 L320 230 L410 90 L620 400 Z" fill="#1f4d3a"/><path d="M230 110 L270 165 L245 185 L215 160 Z M410 90 L455 150 L425 170 L390 140 Z" fill="#f2efe6"/><circle cx="520" cy="90" r="48" fill="#e8c547"/></svg>`),
  },
  {
    name: 'Wave',
    src: svg(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="300" viewBox="0 0 640 300"><path d="M0 170 C80 90 160 90 240 170 S400 250 480 170 S600 90 640 130 L640 300 L0 300Z" fill="#2a4f9a"/><path d="M0 210 C80 140 160 140 240 210 S400 280 480 210 S600 140 640 170 L640 300 L0 300Z" fill="#9fd8ff"/></svg>`),
  },
  {
    name: 'Stamp',
    src: svg(`<svg xmlns="http://www.w3.org/2000/svg" width="620" height="300" viewBox="0 0 620 300"><rect x="12" y="12" width="596" height="276" rx="18" fill="none" stroke="#b5302a" stroke-width="14" stroke-dasharray="26 10"/><text x="310" y="170" font-family="Bebas Neue,Impact" font-size="150" text-anchor="middle" fill="#b5302a">ORIGINAL</text><text x="310" y="240" font-family="Space Mono,monospace" font-size="34" text-anchor="middle" fill="#b5302a">QUALITY GOODS · No. 07</text></svg>`),
  },
];
const SHAPES = ['circle', 'square', 'triangle', 'star', 'heart', 'badge'] as const;

interface Saved {
  id: string;
  name: string;
  date: number;
  thumb: string;
  design: Design;
}

const colorName = (c: string) => TEE_COLORS.find((t) => t.id === c)?.label ?? 'Custom';
const isDark = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11 < 110;
};
const optionLabel = <K extends keyof typeof STYLE_OPTIONS>(k: K, id: string) => STYLE_OPTIONS[k].find((o) => o.id === id)?.label ?? id;

/* ───────────────────────────── history with coalescing */

function useHistory(initial: Design) {
  const [state, setState] = useState({ past: [] as Design[], present: initial, future: [] as Design[] });
  const last = useRef({ key: '', t: 0 });
  const set = useCallback((next: Design | ((d: Design) => Design), key = '') => {
    setState((s) => {
      const value = typeof next === 'function' ? next(s.present) : next;
      const now = Date.now();
      const coalesce = key && key === last.current.key && now - last.current.t < 700;
      last.current = { key, t: now };
      if (coalesce) return { ...s, present: value };
      return { past: [...s.past.slice(-60), s.present], present: value, future: [] };
    });
  }, []);
  /** replace without creating an undo step (live drag) */
  const replace = useCallback((value: Design) => setState((s) => ({ ...s, present: value })), []);
  const undo = useCallback(() => setState((s) => (s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] } : s)), []);
  const redo = useCallback(() => setState((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) } : s)), []);
  const pushSnapshot = useCallback((d: Design) => setState((s) => ({ past: [...s.past, d], present: s.present, future: [] })), []);
  return { design: state.present, set, replace, undo, redo, canUndo: state.past.length > 0, canRedo: state.future.length > 0, pushSnapshot };
}

export default function TShirtStudio() {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<TeeEngine | null>(null);
  const hist = useHistory(DEFAULT_DESIGN);
  const { design, set } = hist;
  const designRef = useRef(design);
  designRef.current = design;
  const dragStart = useRef<Design | null>(null);
  const [selected, setSelected] = useState<string | null>('starter');
  const [side, setSide] = useState<Side>('front');
  const [zone, setZone] = useState<Zone>('body');
  const [backdrop, setBackdrop] = useState(BACKDROPS[0]);
  const [spin, setSpin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [saved, setSaved] = useState<Saved[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORE) || '[]');
    } catch {
      return [];
    }
  });
  const [compare, setCompare] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { notify } = useShop();

  // engine lifecycle
  useEffect(() => {
    if (!host.current) return;
    let e: TeeEngine;
    try {
      e = new TeeEngine(host.current, {
        onSelect: (id) => setSelected(id),
        onMove: (id, x, y, commit) => {
          if (!dragStart.current) dragStart.current = designRef.current;
          const next = { ...designRef.current, layers: designRef.current.layers.map((l) => (l.id === id ? { ...l, x, y } : l)) };
          hist.replace(next);
          if (commit) {
            hist.pushSnapshot(dragStart.current);
            dragStart.current = null;
          }
        },
        onLoading: (l) => {
          setLoading(l);
          if (!l) {
            setReady(true);
            setEngineError(null);
          }
        },
        onError: (m) => setEngineError(m),
      });
    } catch {
      setEngineError('This browser cannot run the 3D designer because WebGL is unavailable. Please try a recent version of Chrome, Safari or Edge.');
      setLoading(false);
      return;
    }
    engine.current = e;
    e.setDesign(designRef.current);
    document.fonts.ready.then(() => e.paint());
    FONTS.forEach((f) => document.fonts.load(`40px "${f}"`).then(() => e.paint()).catch(() => undefined));
    return () => {
      e.dispose();
      engine.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => engine.current?.setDesign(design), [design]);
  useEffect(() => engine.current?.setSelection(selected), [selected]);
  useEffect(() => engine.current?.spin(spin), [spin]);

  // keyboard: undo/redo, delete, nudge
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? '').toUpperCase();
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) hist.redo();
        else hist.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        hist.redo();
        return;
      }
      if (!selected) return;
      if (e.key === 'Delete' || e.key === 'Backspace') remove(selected);
      const n = e.shiftKey ? 30 : 6;
      const d = { ArrowLeft: [-n, 0], ArrowRight: [n, 0], ArrowUp: [0, -n], ArrowDown: [0, n] }[e.key];
      if (d) {
        e.preventDefault();
        update(selected, (l) => ({ x: l.x + d[0], y: l.y + d[1] }), 'nudge');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const layer = design.layers.find((l) => l.id === selected) ?? null;
  const update = (id: string, patch: Partial<Layer> | ((l: Layer) => Partial<Layer>), key = '') =>
    set((d) => ({ ...d, layers: d.layers.map((l) => (l.id === id ? { ...l, ...(typeof patch === 'function' ? patch(l) : patch) } : l)) }), key ? `${key}:${id}` : '');
  const setGarment = <K extends keyof Design>(k: K, v: Design[K]) => set((d) => ({ ...d, [k]: v }), k === 'color' ? 'color' : '');
  const ink = isDark(design.color) ? '#f2efe6' : '#111111';

  const add = (partial: Partial<Layer> & Pick<Layer, 'type' | 'name'>) => {
    const [x, y] = engine.current?.zoneCentre(side, zone) ?? [W / 2, 780];
    const l: Layer = { id: newId(), side, zone, x, y, s: zone === 'body' ? 1 : 0.35, r: 0, a: 1, flip: false, visible: true, locked: false, ...partial };
    set((d) => ({ ...d, layers: [...d.layers, l] }));
    setSelected(l.id);
  };
  const remove = (id: string) => {
    set((d) => ({ ...d, layers: d.layers.filter((l) => l.id !== id) }));
    setSelected(null);
  };
  const move = (id: string, dir: 1 | -1) =>
    set((d) => {
      const a = [...d.layers];
      const i = a.findIndex((l) => l.id === id);
      const j = i + dir;
      if (j < 0 || j >= a.length) return d;
      [a[i], a[j]] = [a[j], a[i]];
      return { ...d, layers: a };
    });
  const duplicate = (id: string) => {
    const o = design.layers.find((l) => l.id === id);
    if (!o) return;
    const c = { ...o, id: newId(), x: o.x + 40, y: o.y + 40, name: `${o.name} copy` };
    set((d) => ({ ...d, layers: [...d.layers, c] }));
    setSelected(c.id);
  };

  const chooseSide = (s: Side, z: Zone = 'body') => {
    setSide(s);
    setZone(z);
    engine.current?.view(z === 'sleeveL' ? 'right' : z === 'sleeveR' ? 'left' : s);
  };

  const upload = (f: File) => {
    setError(null);
    if (!/^image\/(png|jpe?g|webp|svg\+xml|gif)$/.test(f.type)) return setError('That file type is not supported. Please upload a PNG, JPG, WebP or SVG image.');
    if (f.size > MAX_UPLOAD) return setError('That image is larger than 10 MB. Please choose a smaller file.');
    const r = new FileReader();
    r.onload = () => {
      const src = r.result as string;
      const im = new Image();
      im.onload = () => {
        const iw = im.naturalWidth || 600;
        const ih = im.naturalHeight || 600;
        const k = Math.min(700 / iw, 700 / ih);
        add({ type: 'image', name: f.name.replace(/\.[a-z]+$/i, '').slice(0, 24) || 'Image', src, w: iw * k, h: ih * k });
      };
      im.onerror = () => setError('That image could not be read. It may be damaged; please try another file.');
      im.src = src;
    };
    r.onerror = () => setError('That file could not be read. Please try again.');
    r.readAsDataURL(f);
  };
  const addGraphic = (g: (typeof GRAPHICS)[number]) => {
    const im = new Image();
    im.onload = () => {
      const iw = im.naturalWidth || 600;
      const ih = im.naturalHeight || 600;
      const k = Math.min(560 / iw, 560 / ih);
      add({ type: 'image', name: g.name, src: g.src, w: iw * k, h: ih * k });
    };
    im.src = g.src;
  };

  const backgroundForMockup = useCallback(async (): Promise<string | HTMLImageElement> => {
    if (!backdrop.img) return backdrop.fill;
    const im = new Image();
    im.src = backdrop.img;
    await im.decode().catch(() => undefined);
    return im;
  }, [backdrop]);
  const downloadUrl = (url: string, name: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
  };

  const saveDesign = async () => {
    const e = engine.current;
    if (!e) return;
    const thumb = e.mockup(0.5, backdrop.fill);
    const small = await shrink(thumb, 420);
    const item: Saved = { id: newId(), name: `Design ${saved.length + 1}`, date: Date.now(), thumb: small, design };
    const next = [item, ...saved].slice(0, 12);
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
      setSaved(next);
      notify('Design saved on this device');
    } catch {
      notify('Storage is full: remove a saved design or use smaller images');
    }
  };
  const deleteSaved = (id: string) => {
    const next = saved.filter((s) => s.id !== id);
    setSaved(next);
    setCompare((c) => c.filter((x) => x !== id));
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch {
      /* the list in memory is still correct */
    }
  };

  const summary = `${optionLabel('fit', design.fit)}, ${optionLabel('sleeve', design.sleeve).toLowerCase()}, ${optionLabel('neck', design.neck).toLowerCase()}, ${optionLabel('fabric', design.fabric).toLowerCase()}, ${colorName(design.color).toLowerCase()}`;
  const dark = backdrop.id === 'charcoal';

  return (
    <>
      <Seo title="3D T-Shirt Designer" description="Design a T-shirt on a realistic 3D garment: fit, sleeves, neckline, fabric and colour, with text, logos and graphics on the front, back and sleeves, and print-ready export." path="/tshirt" />

      <div className="container-lux pt-4 pb-3 sm:pt-6 lg:flex lg:items-baseline lg:justify-between lg:gap-8">
        <h1 className="display text-[30px] leading-tight sm:text-[38px]">Design your T-shirt</h1>
        <p className="mt-1 text-[14px] text-cocoa lg:mt-0">Drag prints on the shirt to place them. Everything stays on your device.</p>
      </div>

      <section className="container-lux grid grid-cols-[minmax(0,1fr)] gap-5 pb-16 lg:h-[max(660px,calc(100svh-152px))] lg:grid-cols-[minmax(0,1fr)_360px] lg:pb-10">
        {/* ─── stage ─── */}
        <div className="sticky top-16 z-20 -mx-4 bg-ivory px-4 pb-2 sm:mx-0 sm:px-0 lg:static lg:m-0 lg:h-full lg:p-0">
          <div className="relative h-[52svh] min-h-[300px] overflow-hidden rounded-lg transition-[background] duration-500 sm:h-[60svh] lg:h-full" style={{ background: backdrop.css }}>
            <div ref={host} className="absolute inset-0" aria-label="3D T-shirt preview. Drag to rotate; drag a print to move it." role="img" />

            {/* first load: a quiet placeholder instead of an empty box */}
            <AnimatePresence>
              {!ready && !engineError && (
                <motion.div key="load" exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3" role="status">
                  <Loader2 className={`h-6 w-6 animate-spin ${dark ? 'text-ivory' : 'text-gold'}`} />
                  <span className={`text-[13px] font-medium ${dark ? 'text-ivory/80' : 'text-cocoa'}`}>Preparing your garment</span>
                </motion.div>
              )}
            </AnimatePresence>
            {ready && loading && (
              <div className="pointer-events-none absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-md bg-white/95 px-3 py-1.5 text-[12.5px] font-medium text-ink shadow-soft" role="status">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" /> Tailoring
              </div>
            )}
            {engineError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center" role="alert">
                <p className={`max-w-sm text-[14px] ${dark ? 'text-ivory' : 'text-cocoa'}`}>{engineError}</p>
                {engine.current && (
                  <button className="btn-primary min-h-10 px-4 text-[13px]" onClick={() => { setEngineError(null); engine.current?.retry(); }}>
                    Try again
                  </button>
                )}
              </div>
            )}

            <div className="absolute top-3 left-3 flex gap-1">
              <ToolBtn label="Undo (Ctrl+Z)" onClick={hist.undo} disabled={!hist.canUndo}>
                <Undo2 className="h-4 w-4" />
              </ToolBtn>
              <ToolBtn label="Redo (Ctrl+Shift+Z)" onClick={hist.redo} disabled={!hist.canRedo}>
                <Redo2 className="h-4 w-4" />
              </ToolBtn>
              <ToolBtn label="Reset design" onClick={() => { set(DEFAULT_DESIGN); setSelected('starter'); }}>
                <RotateCcw className="h-4 w-4" />
              </ToolBtn>
            </div>
            <div className="absolute top-3 right-3 flex gap-1">
              <ToolBtn label="Save design" onClick={saveDesign}>
                <Save className="h-4 w-4" />
              </ToolBtn>
              <button className="btn-primary min-h-10 px-4 text-[13px]" onClick={() => setExportOpen(true)}>
                <Download className="h-4 w-4" /> Export
              </button>
            </div>
            <div className="absolute inset-x-3 bottom-3 flex justify-center">
              <div className="flex items-center gap-0.5 rounded-md bg-white/95 p-1 shadow-soft">
                {(['front', 'left', 'back', 'right'] as View[]).map((v) => (
                  <button key={v} onClick={() => { setSpin(false); engine.current?.view(v); }} className="min-h-9 rounded-sm px-2.5 text-[12.5px] font-semibold text-cocoa capitalize transition-colors hover:bg-cream hover:text-ink sm:px-3">
                    {v}
                  </button>
                ))}
                <span className="mx-0.5 h-5 w-px bg-line" aria-hidden />
                <button onClick={() => setSpin((s) => !s)} aria-pressed={spin} aria-label="Turn the shirt slowly" title="Turn slowly" className={`flex min-h-9 items-center gap-1 rounded-sm px-2.5 text-[12.5px] font-semibold transition-colors ${spin ? 'bg-ink text-ivory' : 'text-cocoa hover:bg-cream'}`}>
                  <Rotate3d className="h-3.5 w-3.5" /> <span className="hidden sm:inline">360°</span>
                </button>
                <button onClick={() => engine.current?.zoom(0.8)} aria-label="Zoom in" className="flex min-h-9 items-center rounded-sm px-2 text-cocoa hover:bg-cream"><Plus className="h-4 w-4" /></button>
                <button onClick={() => engine.current?.zoom(1.25)} aria-label="Zoom out" className="flex min-h-9 items-center rounded-sm px-2 text-cocoa hover:bg-cream"><Minus className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── options ─── */}
        <aside className="scrollbar-thin min-h-0 min-w-0 lg:overflow-y-auto lg:pr-1">
          <Section title="Garment" summary={summary} defaultOpen>
            <Field label="Colour" value={colorName(design.color)}>
              <div className="flex flex-wrap gap-2">
                {TEE_COLORS.map((c) => (
                  <button key={c.id} onClick={() => setGarment('color', c.id)} title={c.label} aria-label={c.label} aria-pressed={design.color === c.id} className={`h-8 w-8 rounded-full border border-black/10 outline-offset-2 transition-transform hover:scale-110 ${design.color === c.id ? 'outline-2 outline-ink' : ''}`} style={{ background: c.id }} />
                ))}
                <label className={`relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-dashed border-muted text-muted outline-offset-2 transition-transform hover:scale-110 ${TEE_COLORS.some((c) => c.id === design.color) ? '' : 'outline-2 outline-ink'}`} title="Custom colour">
                  <Plus className="h-3.5 w-3.5" />
                  <input type="color" value={design.color} onChange={(e) => setGarment('color', e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Custom garment colour" />
                </label>
              </div>
            </Field>
            <Field label="Fit">
              <Segmented value={design.fit} options={STYLE_OPTIONS.fit} onChange={(v) => setGarment('fit', v)} />
            </Field>
            <Field label="Sleeves">
              <Segmented value={design.sleeve} options={STYLE_OPTIONS.sleeve} onChange={(v) => setGarment('sleeve', v)} />
            </Field>
            <Field label="Neckline">
              <Segmented value={design.neck} options={STYLE_OPTIONS.neck} onChange={(v) => setGarment('neck', v)} wrap />
            </Field>
            <Field label="Fabric" value={FABRIC_NOTES[design.fabric]}>
              <div className="grid grid-cols-2 gap-1.5">
                {STYLE_OPTIONS.fabric.map((o) => (
                  <button key={o.id} onClick={() => setGarment('fabric', o.id)} aria-pressed={design.fabric === o.id} className={`min-h-10 rounded-sm border px-2.5 text-left text-[12.5px] font-semibold transition-colors ${design.fabric === o.id ? 'border-ink bg-ink text-ivory' : 'border-line bg-white text-cocoa hover:border-champagne hover:text-ink'}`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <ColorField label="Collar" value={design.collarColor} fallback={design.color} onChange={(v) => setGarment('collarColor', v)} />
              <ColorField label="Sleeves" value={design.sleeveColor} fallback={design.color} onChange={(v) => setGarment('sleeveColor', v)} />
            </div>
          </Section>

          <Section title="Artwork" summary={`${design.layers.length} ${design.layers.length === 1 ? 'print' : 'prints'}`} defaultOpen>
            <Field label="Print on">
              <div className="grid grid-cols-4 gap-1">
                {(
                  [
                    ['front', 'body', 'Front'],
                    ['back', 'body', 'Back'],
                    ['front', 'sleeveL', 'Left sleeve'],
                    ['front', 'sleeveR', 'Right sleeve'],
                  ] as const
                ).map(([s, z, label]) => (
                  <button key={label} onClick={() => chooseSide(s, z)} aria-pressed={side === s && zone === z} className={`min-h-10 rounded-sm border px-1 text-[12px] leading-tight font-semibold transition-colors ${side === s && zone === z ? 'border-ink bg-ink text-ivory' : 'border-line bg-white text-cocoa hover:border-champagne'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-primary min-h-10 px-3 text-[13px]" onClick={() => add({ type: 'text', name: 'Your text', text: 'YOUR TEXT', font: 'Archivo Black', size: 170, fill: ink, stroke: '#ffffff', strokeWidth: 0, align: 'center' })}>
                <Type className="h-4 w-4" /> Text
              </button>
              <button className="btn-ghost min-h-10 px-3 text-[13px]" onClick={() => fileInput.current?.click()}>
                <ImagePlus className="h-4 w-4" /> Upload
              </button>
            </div>
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" tabIndex={-1} aria-label="Upload artwork" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
            {error && (
              <p className="flex items-start gap-2 rounded-sm border border-danger/25 bg-[#fbefed] p-2 text-[12px] text-danger" role="alert">
                <span className="flex-1">{error}</span>
                <button onClick={() => setError(null)} aria-label="Dismiss"><X className="h-3.5 w-3.5" /></button>
              </p>
            )}
            <div className="grid grid-cols-5 gap-1.5">
              {GRAPHICS.map((g) => (
                <button key={g.name} onClick={() => addGraphic(g)} title={g.name} aria-label={`Add ${g.name}`} className="flex aspect-square items-center justify-center rounded-sm border border-line bg-white p-1.5 transition-colors hover:border-champagne">
                  <img src={g.src} alt="" className="max-h-full max-w-full" />
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {SHAPES.map((sh) => (
                <button key={sh} className="chip capitalize" onClick={() => add({ type: 'shape', name: sh, shape: sh, w: 360, fill: ink })}>
                  {sh}
                </button>
              ))}
            </div>

            {design.layers.length > 0 && (
              <ul className="space-y-1 border-t border-line-soft pt-3" aria-label="Layers">
                {[...design.layers].reverse().map((l) => (
                  <li key={l.id} className={`flex items-center gap-2 rounded-sm border px-2 py-1.5 text-[12.5px] transition-colors ${l.id === selected ? 'border-ink bg-cream' : 'border-line bg-white hover:border-champagne'}`}>
                    <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => { setSelected(l.id); chooseSide(l.side, l.zone); }}>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xs bg-pearl text-[10px] font-bold text-gold-deep uppercase">{l.type[0]}</span>
                      <span className="truncate font-medium">{l.type === 'text' ? (l.text || ' ').split('\n')[0] : l.name}</span>
                      <span className="shrink-0 text-[11px] text-muted">{l.zone === 'body' ? l.side : l.zone === 'sleeveL' ? 'L sleeve' : 'R sleeve'}</span>
                    </button>
                    <button aria-label={l.visible ? 'Hide layer' : 'Show layer'} onClick={() => update(l.id, { visible: !l.visible })} className="p-1 text-muted hover:text-ink">
                      {l.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </button>
                    <button aria-label={l.locked ? 'Unlock layer' : 'Lock layer'} onClick={() => update(l.id, { locked: !l.locked })} className="p-1 text-muted hover:text-ink">
                      {l.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <AnimatePresence initial={false}>
              {layer && (
                <motion.div key={layer.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
                  <div className="space-y-3 rounded-md border border-line bg-white p-3">
                    {layer.type === 'text' && (
                      <>
                        <textarea value={layer.text} onChange={(e) => update(layer.id, { text: e.target.value }, 'text')} rows={2} className="field resize-none font-semibold" aria-label="Text" />
                        <div className="flex gap-1.5">
                          <select value={layer.font} onChange={(e) => update(layer.id, { font: e.target.value })} className="field min-w-0 flex-1" aria-label="Font">
                            {FONTS.map((f) => (
                              <option key={f} value={f} style={{ fontFamily: f }}>
                                {f.replace(' Variable', '')}
                              </option>
                            ))}
                          </select>
                          {(['left', 'center', 'right'] as const).map((a) => (
                            <button key={a} onClick={() => update(layer.id, { align: a })} aria-label={`Align ${a}`} aria-pressed={layer.align === a} className={`flex w-10 shrink-0 items-center justify-center rounded-sm border ${layer.align === a ? 'border-ink bg-ink text-ivory' : 'border-line'}`}>
                              {a === 'left' ? <AlignLeft className="h-4 w-4" /> : a === 'center' ? <AlignCenter className="h-4 w-4" /> : <AlignRight className="h-4 w-4" />}
                            </button>
                          ))}
                        </div>
                        <Range label="Text size" min={40} max={420} step={2} value={layer.size ?? 150} onChange={(v) => update(layer.id, { size: v }, 'size')} />
                        <Range label="Outline" min={0} max={24} step={1} value={layer.strokeWidth ?? 0} onChange={(v) => update(layer.id, { strokeWidth: v }, 'stroke')} />
                        <div className="grid grid-cols-2 gap-2">
                          <ColorField label="Text colour" value={layer.fill ?? '#111111'} onChange={(v) => update(layer.id, { fill: v ?? '#111111' }, 'fill')} />
                          <ColorField label="Outline colour" value={layer.stroke ?? '#ffffff'} onChange={(v) => update(layer.id, { stroke: v ?? '#ffffff' }, 'strokec')} />
                        </div>
                      </>
                    )}
                    {layer.type === 'shape' && <ColorField label="Fill" value={layer.fill ?? '#111111'} onChange={(v) => update(layer.id, { fill: v ?? '#111111' }, 'fill')} />}
                    <Range label="Scale" min={0.1} max={3} step={0.01} value={layer.s} onChange={(v) => update(layer.id, { s: v }, 'scale')} />
                    <Range label="Rotate" min={-180} max={180} step={1} value={layer.r} onChange={(v) => update(layer.id, { r: v }, 'rot')} suffix="°" />
                    <Range label="Opacity" min={0.1} max={1} step={0.01} value={layer.a} onChange={(v) => update(layer.id, { a: v }, 'alpha')} />
                    <div className="grid grid-cols-3 gap-1.5">
                      <SmallBtn onClick={() => { const [x] = engine.current?.zoneCentre(layer.side, layer.zone) ?? [W / 2]; update(layer.id, { x }); }}>Centre</SmallBtn>
                      <SmallBtn onClick={() => update(layer.id, { flip: !layer.flip })}><FlipHorizontal className="h-3.5 w-3.5" /> Flip</SmallBtn>
                      <SmallBtn onClick={() => duplicate(layer.id)}><Copy className="h-3.5 w-3.5" /> Copy</SmallBtn>
                      <SmallBtn onClick={() => move(layer.id, 1)}><ArrowUp className="h-3.5 w-3.5" /> Forward</SmallBtn>
                      <SmallBtn onClick={() => move(layer.id, -1)}><ArrowDown className="h-3.5 w-3.5" /> Back</SmallBtn>
                      <SmallBtn danger onClick={() => remove(layer.id)}><Trash2 className="h-3.5 w-3.5" /> Delete</SmallBtn>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Section>

          <Section title="Backdrop" summary={backdrop.label}>
            <div className="flex flex-wrap gap-2" aria-label="Mockup background">
              {BACKDROPS.map((b) => (
                <button key={b.id} onClick={() => setBackdrop(b)} title={b.label} aria-label={`${b.label} background`} aria-pressed={backdrop.id === b.id} className={`h-9 w-9 rounded-sm border border-black/10 outline-offset-2 transition-transform hover:scale-105 ${backdrop.id === b.id ? 'outline-2 outline-ink' : ''}`} style={{ background: b.css }} />
              ))}
            </div>
          </Section>

          <Section title="Saved designs" summary={saved.length ? `${saved.length} on this device` : 'None yet'}>
            {saved.length === 0 ? (
              <p className="text-[12.5px] text-muted">Use the save button on the preview to keep a design on this device and compare it with others.</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {saved.map((s) => (
                    <div key={s.id} className={`relative overflow-hidden rounded-sm border bg-white ${compare.includes(s.id) ? 'border-ink' : 'border-line'}`}>
                      <button onClick={() => { set(s.design); setSelected(null); }} className="block w-full" title={`Load ${s.name}`}>
                        <img src={s.thumb} alt={s.name} className="aspect-square w-full object-cover" />
                      </button>
                      <div className="flex items-center justify-between gap-1 px-1.5 py-1 text-[11px]">
                        <label className="flex items-center gap-1">
                          <input type="checkbox" checked={compare.includes(s.id)} onChange={(e) => setCompare((c) => (e.target.checked ? [...c, s.id].slice(-2) : c.filter((x) => x !== s.id)))} />
                          Compare
                        </label>
                        <button onClick={() => deleteSaved(s.id)} aria-label={`Delete ${s.name}`} className="text-muted hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <button disabled={compare.length !== 2} onClick={() => setCompareOpen(true)} className="btn-ghost min-h-10 w-full text-[13px] disabled:opacity-40">
                  <Columns2 className="h-4 w-4" /> Compare selected ({compare.length}/2)
                </button>
              </>
            )}
          </Section>

          <Link to={`/contact?about=${encodeURIComponent(`Custom T-shirt: ${summary}, ${design.layers.length} print${design.layers.length === 1 ? '' : 's'}`)}`} className="btn-primary mt-4 min-h-11 w-full text-[13.5px]">
            Request a quote <ArrowRight className="h-4 w-4" />
          </Link>
        </aside>
      </section>

      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} engine={engine} design={design} background={backgroundForMockup} download={downloadUrl} />
      <AnimatePresence>
        {compareOpen && (
          <Modal onClose={() => setCompareOpen(false)} title="Compare designs">
            <div className="grid gap-4 sm:grid-cols-2">
              {compare.map((id) => {
                const s = saved.find((x) => x.id === id);
                if (!s) return null;
                return (
                  <figure key={id} className="overflow-hidden rounded-md border border-line bg-white">
                    <img src={s.thumb} alt={s.name} className="aspect-square w-full object-cover" />
                    <figcaption className="space-y-1 p-3 text-[12.5px]">
                      <p className="font-semibold">{s.name}</p>
                      <p className="text-muted capitalize">{s.design.fit} · {s.design.sleeve} sleeve · {s.design.neck} · {s.design.layers.length} layers</p>
                      <button className="btn-link mt-1" onClick={() => { set(s.design); setCompareOpen(false); }}>Load this design</button>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}

async function shrink(url: string, max: number) {
  const im = new Image();
  im.src = url;
  await im.decode();
  const k = Math.min(1, max / Math.max(im.width, im.height));
  const c = document.createElement('canvas');
  c.width = Math.round(im.width * k);
  c.height = Math.round(im.height * k);
  c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}

type ExportTab = 'mockup' | 'front' | 'back' | 'sleeves';

function ExportModal({ open, onClose, engine, design, background, download }: { open: boolean; onClose: () => void; engine: React.RefObject<TeeEngine | null>; design: Design; background: () => Promise<string | HTMLImageElement>; download: (u: string, n: string) => void }) {
  const [tab, setTab] = useState<ExportTab>('mockup');
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hasSleeves = design.layers.some((l) => l.zone !== 'body' && l.visible);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      const e = engine.current;
      if (!e) return;
      setBusy(true);
      // let the "Rendering" state paint before the heavy work
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const url = tab === 'mockup' ? e.mockup(Math.min(3, (window.devicePixelRatio || 1) * 1.5), await background()) : tab === 'sleeves' ? e.printFile('front', 2, 'sleeve') : e.printFile(tab, 2);
      if (alive) {
        setPreview(url);
        setBusy(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, tab, engine, background]);
  if (!open) return null;
  const tabs: [ExportTab, string][] = [
    ['mockup', 'Hi-res mockup'],
    ['front', 'Front print file'],
    ['back', 'Back print file'],
  ];
  if (hasSleeves) tabs.push(['sleeves', 'Sleeve print file']);
  return (
    <Modal onClose={onClose} title="Export">
      <div className="flex flex-wrap gap-1.5">
        {tabs.map(([id, l]) => (
          <button key={id} onClick={() => setTab(id)} className={tab === id ? 'chip-on' : 'chip'}>
            {l}
          </button>
        ))}
      </div>
      <div className="mt-4 flex min-h-[300px] items-center justify-center rounded-md bg-[repeating-conic-gradient(#eee8dd_0_25%,#fff_0_50%)] bg-[length:20px_20px] p-3">
        {busy || !preview ? <span className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Rendering</span> : <img src={preview} alt="Export preview" className="max-h-[52vh] w-auto rounded-xs" />}
      </div>
      <p className="mt-2 text-[12px] text-muted">
        {tab === 'mockup'
          ? 'The current camera angle, rendered at up to 3× resolution on your backdrop.'
          : 'Transparent PNG at 2× canvas resolution (3072 × 4200 px), 28 px per centimetre of cloth, so artwork prints at the size shown.'}
      </p>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button className="btn-ghost" onClick={() => download(URL.createObjectURL(new Blob([JSON.stringify(design, null, 2)], { type: 'application/json' })), 'tee-design.json')}>
          <FileJson className="h-4 w-4" /> Design JSON
        </button>
        <button className="btn-primary" disabled={!preview || busy} onClick={() => preview && download(preview, tab === 'mockup' ? 'tee-mockup.png' : `tee-print-${tab}.png`)}>
          <Download className="h-4 w-4" /> Download PNG
        </button>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <motion.div className="fixed inset-0 z-60 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-ink/45" onClick={onClose} />
      <motion.div role="dialog" aria-modal="true" aria-label={title} className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-ivory p-6 shadow-lift" initial={{ y: 16, scale: 0.98 }} animate={{ y: 0, scale: 1 }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="display text-2xl">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-sm p-2 text-muted hover:bg-cream"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

/** Collapsible option group. The header always shows the current choice. */
function Section({ title, summary, defaultOpen = false, children }: { title: string; summary: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-line-soft py-1 first:pt-0">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 py-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-ink">{title}</span>
          {!open && <span className="block truncate text-[12px] text-muted first-letter:uppercase">{summary}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
            <div className="space-y-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Field({ label, value, children }: { label: string; value?: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[12px] text-cocoa">
        {label}
        {value && <span className="font-semibold text-ink">: {value}</span>}
      </p>
      {children}
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange, wrap }: { value: T; options: readonly { id: T; label: string }[]; onChange: (v: T) => void; wrap?: boolean }) {
  return (
    <div className={`${wrap ? 'flex flex-wrap' : 'flex'} gap-1 rounded-md bg-pearl p-1`}>
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} aria-pressed={value === o.id} className={`min-h-9 flex-1 rounded-sm px-2.5 text-[12.5px] font-semibold whitespace-nowrap transition-colors ${value === o.id ? 'bg-white text-ink shadow-soft' : 'text-cocoa hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ToolBtn({ children, label, onClick, disabled }: { children: ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={label} className="flex h-10 w-10 items-center justify-center rounded-md bg-white/95 text-ink shadow-soft transition-colors hover:bg-white disabled:opacity-40">
      {children}
    </button>
  );
}
function SmallBtn({ children, onClick, danger }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`flex h-9 items-center justify-center gap-1 rounded-sm border border-line text-[11.5px] font-semibold transition-colors ${danger ? 'text-danger hover:border-danger' : 'text-cocoa hover:border-ink hover:text-ink'}`}>
      {children}
    </button>
  );
}
function Range({ label, value, min, max, step, onChange, suffix = '' }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <label className="block text-[12px] text-cocoa">
      <span className="flex justify-between">
        {label}
        <span className="font-semibold text-ink">{step < 1 ? value.toFixed(2) : Math.round(value)}{suffix}</span>
      </span>
      <input type="range" className="lux-range mt-1.5" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </label>
  );
}
function ColorField({ label, value, fallback, onChange }: { label: string; value: string | null; fallback?: string; onChange: (v: string | null) => void }) {
  return (
    <label className="relative flex min-h-10 items-center gap-2 rounded-sm border border-line bg-white px-2.5 text-[12px] font-medium text-cocoa">
      <span className="h-5 w-5 shrink-0 rounded-full border border-black/10" style={{ background: value ?? fallback }} />
      <span className="truncate">{label}</span>
      {value !== null && fallback && (
        <button type="button" className="relative z-10 ml-auto text-[11px] font-semibold text-gold-deep" onClick={(e) => { e.preventDefault(); onChange(null); }}>
          Match
        </button>
      )}
      <input type="color" value={value ?? fallback ?? '#000000'} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={label} />
    </label>
  );
}
