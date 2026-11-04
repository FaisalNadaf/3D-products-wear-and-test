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
  ArrowUp,
  ChevronRight,
  Columns2,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileJson,
  FlipHorizontal,
  ImagePlus,
  Lock,
  Minus,
  Plus,
  Redo2,
  RotateCcw,
  Rotate3d,
  Save,
  Shapes,
  Trash2,
  Type,
  Undo2,
  Unlock,
  X,
} from 'lucide-react';
import { Seo } from '../components/site/Seo';
import { useShop } from '../state/shop';
import { DEFAULT_DESIGN, FONTS, STYLE_OPTIONS, TEE_COLORS, newId, type Design, type Layer, type Side, type Zone } from '../features/tshirt/design';
import { TeeEngine, W, type View } from '../features/tshirt/TeeEngine';

const B = import.meta.env.BASE_URL;
const STORE = 'cubiccode.tee-designs';
const MAX_UPLOAD = 10 * 1024 * 1024;

const BACKDROPS = [
  { id: 'ivory', label: 'Ivory studio', css: 'radial-gradient(ellipse at 50% 30%,#fdfbf7,#ebe4d8)', fill: '#efe9df' },
  { id: 'sand', label: 'Warm sand', css: 'radial-gradient(ellipse at 50% 30%,#f3ebdf,#dccbb2)', fill: '#e6d9c4' },
  { id: 'grey', label: 'Cool grey', css: 'radial-gradient(ellipse at 50% 30%,#f4f5f6,#d6d9dc)', fill: '#e2e4e6' },
  { id: 'sage', label: 'Sage', css: 'radial-gradient(ellipse at 50% 30%,#eef1ea,#c9d2c1)', fill: '#d9dfd3' },
  { id: 'blush', label: 'Blush', css: 'radial-gradient(ellipse at 50% 30%,#fbf1ef,#e8cfca)', fill: '#f0dfdb' },
  { id: 'charcoal', label: 'Charcoal', css: 'radial-gradient(ellipse at 50% 30%,#4a4a4f,#1f1f22)', fill: '#2b2b2e' },
  { id: 'gallery', label: 'Gallery', css: `center/cover url(${B}backgrounds/gallery.webp)`, img: `${B}backgrounds/gallery.webp`, fill: '#ece7df' },
  { id: 'lounge', label: 'Lounge', css: `center/cover url(${B}backgrounds/lounge.webp)`, img: `${B}backgrounds/lounge.webp`, fill: '#cdb79b' },
];

/** Built-in vector graphics ("company logos" & badges) as data-URL SVGs. */
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

interface Saved {
  id: string;
  name: string;
  date: number;
  thumb: string;
  design: Design;
}

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
  return { design: state.present, set, replace, undo, redo, canUndo: state.past.length > 0, canRedo: state.future.length > 0, pushSnapshot: (d: Design) => setState((s) => ({ past: [...s.past, d], present: s.present, future: [] })) };
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
  const { notify, addToBag } = useShop();

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
      });
    } catch {
      setError('This browser cannot run the 3D designer (WebGL unavailable).');
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
    engine.current?.view(s);
  };

  const upload = (f: File) => {
    setError(null);
    if (!/^image\/(png|jpe?g|webp|svg\+xml|gif)$/.test(f.type)) return setError('Please upload a PNG, JPG, WebP or SVG file.');
    if (f.size > MAX_UPLOAD) return setError('Images must be under 10 MB.');
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
      im.onerror = () => setError('That image could not be read.');
      im.src = src;
    };
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

  const backgroundForMockup = async (): Promise<string | HTMLImageElement> => {
    if (!backdrop.img) return backdrop.fill;
    const im = new Image();
    im.src = backdrop.img;
    await im.decode().catch(() => undefined);
    return im;
  };
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
      /* ignore */
    }
  };

  return (
    <>
      <Seo title="3D T-Shirt Designer" description="Design T-shirts on a 3D garment: styles, colours, text, logos and layers on the front, back and sleeves, with undo/redo, saved designs and print-ready export." path="/tshirt" />
      <section className="container-lux pt-6 sm:pt-10">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12px] text-muted">
          <Link to="/" className="hover:text-ink">
            Home
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span>Experiences</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-ink">T-Shirt Studio</span>
        </nav>
        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow">Apparel Studio · Live 3D Designer</p>
            <h1 className="display mt-3 text-[44px] leading-[0.98] sm:text-6xl lg:text-[72px]">
              Design it. <span className="text-gold italic">Wear it.</span>
            </h1>
          </div>
          <p className="max-w-md text-[15px] leading-relaxed text-cocoa">
            Put text, logos and graphics on the front, back and sleeves of a 3D tee. Drag them into place on the garment, then
            export print-ready artwork.
          </p>
        </div>
      </section>

      <section className="container-lux mt-6 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_300px]">
        {/* left: garment + add */}
        <aside className="panel scrollbar-thin order-2 space-y-5 overflow-y-auto p-4 lg:order-1 lg:h-[min(78vh,760px)]">
          <Panel title="Garment colour">
            <div className="flex flex-wrap gap-2">
              {TEE_COLORS.map((c) => (
                <button key={c.id} onClick={() => setGarment('color', c.id)} title={c.label} aria-label={c.label} aria-pressed={design.color === c.id} className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-105 ${design.color === c.id ? 'border-ink' : 'border-white shadow-[0_0_0_1px_var(--color-line)]'}`} style={{ background: c.id }} />
              ))}
              <label className="relative flex h-8 items-center gap-1.5 rounded-full border border-line px-2.5 text-[11px] font-semibold text-cocoa" title="Custom colour">
                <span className="h-4 w-4 rounded-full border border-line" style={{ background: design.color }} />
                Custom
                <input type="color" value={design.color} onChange={(e) => setGarment('color', e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Custom garment colour" />
              </label>
            </div>
          </Panel>
          <Panel title="Style">
            {(['fit', 'sleeve', 'neck', 'fabric'] as const).map((k) => (
              <div key={k} className="flex flex-wrap gap-1.5">
                {STYLE_OPTIONS[k].map((o) => (
                  <button key={o.id} onClick={() => setGarment(k, o.id as never)} aria-pressed={design[k] === o.id} className={design[k] === o.id ? 'chip-on' : 'chip'}>
                    {o.label}
                  </button>
                ))}
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <ColorField label="Collar trim" value={design.collarColor} fallback={design.color} onChange={(v) => setGarment('collarColor', v)} />
              <ColorField label="Sleeves" value={design.sleeveColor} fallback={design.color} onChange={(v) => setGarment('sleeveColor', v)} />
            </div>
          </Panel>
          <Panel title="Print area">
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  ['front', 'body', 'Front'],
                  ['back', 'body', 'Back'],
                  ['front', 'sleeveL', 'Left sleeve'],
                  ['front', 'sleeveR', 'Right sleeve'],
                ] as const
              ).map(([s, z, label]) => (
                <button key={label} onClick={() => chooseSide(s, z)} aria-pressed={side === s && zone === z} className={side === s && zone === z ? 'chip-on' : 'chip'}>
                  {label}
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="Add">
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-primary min-h-10 px-3 text-[13px]" onClick={() => add({ type: 'text', name: 'Your text', text: 'YOUR TEXT', font: 'Archivo Black', size: 170, fill: design.color === '#141416' ? '#f2efe6' : '#111111', stroke: '#ffffff', strokeWidth: 0, align: 'center' })}>
                <Type className="h-4 w-4" /> Text
              </button>
              <button className="btn-ghost min-h-10 px-3 text-[13px]" onClick={() => fileInput.current?.click()}>
                <ImagePlus className="h-4 w-4" /> Upload
              </button>
            </div>
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" tabIndex={-1} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
            {error && <p className="text-[12px] text-danger" role="alert">{error}</p>}
            <p className="label mt-1">Logos & graphics</p>
            <div className="grid grid-cols-5 gap-1.5">
              {GRAPHICS.map((g) => (
                <button key={g.name} onClick={() => addGraphic(g)} title={g.name} aria-label={`Add ${g.name}`} className="flex aspect-square items-center justify-center rounded-md border border-line bg-white p-1.5 hover:border-champagne">
                  <img src={g.src} alt="" className="max-h-full max-w-full" />
                </button>
              ))}
            </div>
            <p className="label mt-1 flex items-center gap-1"><Shapes className="h-3 w-3" /> Shapes</p>
            <div className="flex flex-wrap gap-1.5">
              {(['circle', 'square', 'triangle', 'star', 'heart', 'badge'] as const).map((sh) => (
                <button key={sh} className="chip capitalize" onClick={() => add({ type: 'shape', name: sh, shape: sh, w: 360, fill: design.color === '#141416' ? '#f2efe6' : '#111111' })}>
                  {sh}
                </button>
              ))}
            </div>
          </Panel>
        </aside>

        {/* centre: stage */}
        <div className="order-1 min-w-0 lg:order-2">
          <div className="relative overflow-hidden rounded-xl border border-line transition-[background] duration-500" style={{ background: backdrop.css }}>
            <div ref={host} className="relative aspect-[4/4.4] w-full sm:aspect-[4/3.4] lg:aspect-auto lg:h-[min(78vh,760px)]" aria-label="3D T-shirt preview. Drag prints to move them." role="img" />
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
            <div className="absolute inset-x-3 bottom-3 flex flex-col items-center gap-2 2xl:flex-row 2xl:justify-between">
              <div className="flex gap-1 rounded-md border border-line bg-white/92 p-1 backdrop-blur">
                {(['front', 'left', 'back', 'right'] as View[]).map((v) => (
                  <button key={v} onClick={() => engine.current?.view(v)} className="rounded-[7px] px-3 py-2 text-[12px] font-semibold text-cocoa capitalize hover:bg-cream hover:text-ink">
                    {v}
                  </button>
                ))}
                <button onClick={() => setSpin((s) => !s)} aria-pressed={spin} className={`flex items-center gap-1 rounded-[7px] px-3 py-2 text-[12px] font-semibold ${spin ? 'bg-ink text-ivory' : 'text-cocoa hover:bg-cream'}`}>
                  <Rotate3d className="h-3.5 w-3.5" /> 360°
                </button>
                <button onClick={() => engine.current?.zoom(0.8)} aria-label="Zoom in" className="rounded-[7px] px-2 text-cocoa hover:bg-cream"><Plus className="h-4 w-4" /></button>
                <button onClick={() => engine.current?.zoom(1.25)} aria-label="Zoom out" className="rounded-[7px] px-2 text-cocoa hover:bg-cream"><Minus className="h-4 w-4" /></button>
              </div>
              <div className="flex gap-1.5 rounded-md border border-line bg-white/92 p-1.5 backdrop-blur" aria-label="Mockup background">
                {BACKDROPS.map((b) => (
                  <button key={b.id} onClick={() => setBackdrop(b)} title={b.label} aria-label={`${b.label} background`} aria-pressed={backdrop.id === b.id} className={`h-6 w-6 rounded-full border-2 ${backdrop.id === b.id ? 'border-ink' : 'border-white shadow-[0_0_0_1px_var(--color-line)]'}`} style={{ background: b.css }} />
                ))}
              </div>
            </div>
            {error && !engine.current && <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-cocoa">{error}</div>}
          </div>
        </div>

        {/* right: layers + properties */}
        <aside className="panel scrollbar-thin order-3 space-y-5 overflow-y-auto p-4 lg:col-span-2 xl:col-span-1 xl:h-[min(78vh,760px)]">
          <Panel title={`Layers · ${design.layers.length}`}>
            {design.layers.length === 0 && <p className="text-[12.5px] text-muted">Nothing added yet. Add text, a logo or a shape.</p>}
            <ul className="space-y-1.5">
              {[...design.layers].reverse().map((l) => (
                <li key={l.id}>
                  <div className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-[12.5px] transition-colors ${l.id === selected ? 'border-ink bg-cream' : 'border-line hover:border-champagne'}`}>
                    <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => { setSelected(l.id); chooseSide(l.side, l.zone); }}>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-white text-[10px] font-bold text-gold-deep uppercase ring-1 ring-line">{l.type[0]}</span>
                      <span className="truncate font-medium">{l.type === 'text' ? (l.text || ' ').split('\n')[0] : l.name}</span>
                      <span className="shrink-0 text-[10.5px] text-muted">{l.zone === 'body' ? l.side : l.zone === 'sleeveL' ? 'L sleeve' : 'R sleeve'}</span>
                    </button>
                    <button aria-label={l.visible ? 'Hide layer' : 'Show layer'} onClick={() => update(l.id, { visible: !l.visible })} className="text-muted hover:text-ink">
                      {l.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </button>
                    <button aria-label={l.locked ? 'Unlock layer' : 'Lock layer'} onClick={() => update(l.id, { locked: !l.locked })} className="text-muted hover:text-ink">
                      {l.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          {layer && (
            <Panel title="Selected layer">
              {layer.type === 'text' && (
                <>
                  <textarea value={layer.text} onChange={(e) => update(layer.id, { text: e.target.value }, 'text')} rows={2} className="field resize-none font-semibold" aria-label="Text" />
                  <select value={layer.font} onChange={(e) => update(layer.id, { font: e.target.value })} className="field" aria-label="Font">
                    {FONTS.map((f) => (
                      <option key={f} value={f} style={{ fontFamily: f }}>
                        {f.replace(' Variable', '')}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-1">
                    {(['left', 'center', 'right'] as const).map((a) => (
                      <button key={a} onClick={() => update(layer.id, { align: a })} aria-label={`Align ${a}`} aria-pressed={layer.align === a} className={`flex h-9 flex-1 items-center justify-center rounded-md border ${layer.align === a ? 'border-ink bg-ink text-ivory' : 'border-line'}`}>
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
              <p className="text-[11.5px] text-muted">Tip: drag the print on the 3D shirt. Arrow keys nudge it; Shift moves it further.</p>
            </Panel>
          )}

          <Panel title={`Saved designs · ${saved.length}`}>
            {saved.length === 0 ? (
              <p className="text-[12.5px] text-muted">Save designs on this device to come back to them or compare them side by side.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {saved.map((s) => (
                    <div key={s.id} className={`group relative overflow-hidden rounded-md border ${compare.includes(s.id) ? 'border-ink ring-2 ring-ink/10' : 'border-line'}`}>
                      <button onClick={() => { set(s.design); setSelected(null); }} className="block w-full" title={`Load ${s.name}`}>
                        <img src={s.thumb} alt={s.name} className="aspect-square w-full object-cover" />
                      </button>
                      <div className="flex items-center justify-between gap-1 px-2 py-1.5 text-[11px]">
                        <label className="flex items-center gap-1">
                          <input type="checkbox" checked={compare.includes(s.id)} onChange={(e) => setCompare((c) => (e.target.checked ? [...c, s.id].slice(-2) : c.filter((x) => x !== s.id)))} />
                          Compare
                        </label>
                        <button onClick={() => deleteSaved(s.id)} aria-label={`Delete ${s.name}`} className="text-muted hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <button disabled={compare.length !== 2} onClick={() => setCompareOpen(true)} className="btn-ghost min-h-10 w-full text-[13px]">
                  <Columns2 className="h-4 w-4" /> Compare selected ({compare.length}/2)
                </button>
              </>
            )}
          </Panel>
          <button className="btn-gold w-full" onClick={() => addToBag('custom-tee', 'Custom T-shirt')}>
            Order this tee · ₹1,499
          </button>
        </aside>
      </section>
      <div className="h-20" />

      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} engine={engine} design={design} background={backgroundForMockup} download={downloadUrl} />
      <AnimatePresence>
        {compareOpen && (
          <Modal onClose={() => setCompareOpen(false)} title="Compare designs">
            <div className="grid gap-4 sm:grid-cols-2">
              {compare.map((id) => {
                const s = saved.find((x) => x.id === id);
                if (!s) return null;
                return (
                  <figure key={id} className="overflow-hidden rounded-lg border border-line">
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

function ExportModal({ open, onClose, engine, design, background, download }: { open: boolean; onClose: () => void; engine: React.RefObject<TeeEngine | null>; design: Design; background: () => Promise<string | HTMLImageElement>; download: (u: string, n: string) => void }) {
  const [tab, setTab] = useState<'mockup' | 'front' | 'back'>('mockup');
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      const e = engine.current;
      if (!e) return;
      setBusy(true);
      const url = tab === 'mockup' ? e.mockup(Math.min(3, (window.devicePixelRatio || 1) * 1.5), await background()) : e.printFile(tab, 2);
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
  return (
    <Modal onClose={onClose} title="Export">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['mockup', 'Hi-res mockup'],
            ['front', 'Front print file'],
            ['back', 'Back print file'],
          ] as const
        ).map(([id, l]) => (
          <button key={id} onClick={() => setTab(id)} className={tab === id ? 'chip-on' : 'chip'}>
            {l}
          </button>
        ))}
      </div>
      <div className="mt-4 flex min-h-[300px] items-center justify-center rounded-lg bg-[repeating-conic-gradient(#eee8dd_0_25%,#fff_0_50%)] bg-[length:20px_20px] p-3">
        {busy || !preview ? <span className="text-sm text-muted">Rendering…</span> : <img src={preview} alt="Export preview" className="max-h-[52vh] w-auto rounded" />}
      </div>
      <p className="mt-2 text-[12px] text-muted">{tab === 'mockup' ? 'Current camera angle, rendered at up to 3× resolution on your mockup background.' : 'Transparent PNG at 2× canvas resolution (3072 × 4200 px), sleeve prints included on the front file.'}</p>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button className="btn-ghost" onClick={() => download(URL.createObjectURL(new Blob([JSON.stringify(design, null, 2)], { type: 'application/json' })), 'tee-design.json')}>
          <FileJson className="h-4 w-4" /> Design JSON
        </button>
        <button className="btn-primary" disabled={!preview} onClick={() => preview && download(preview, tab === 'mockup' ? 'tee-mockup.png' : `tee-print-${tab}.png`)}>
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
    <motion.div className="fixed inset-0 z-[60] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-ink/45 backdrop-blur-sm" onClick={onClose} />
      <motion.div role="dialog" aria-modal="true" aria-label={title} className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-ivory p-6 shadow-lift" initial={{ y: 16, scale: 0.98 }} animate={{ y: 0, scale: 1 }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="display text-2xl">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-2 text-muted hover:bg-cream"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2.5">
      <p className="label mb-0">{title}</p>
      {children}
    </div>
  );
}
function ToolBtn({ children, label, onClick, disabled }: { children: ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={label} className="flex h-10 w-10 items-center justify-center rounded-md border border-line bg-white/92 text-ink backdrop-blur transition-colors hover:border-ink disabled:opacity-35">
      {children}
    </button>
  );
}
function SmallBtn({ children, onClick, danger }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`flex h-9 items-center justify-center gap-1 rounded-md border border-line text-[11.5px] font-semibold transition-colors ${danger ? 'text-danger hover:border-danger' : 'text-cocoa hover:border-ink hover:text-ink'}`}>
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
      <input type="range" className="lux-range mt-2" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </label>
  );
}
function ColorField({ label, value, fallback, onChange }: { label: string; value: string | null; fallback?: string; onChange: (v: string | null) => void }) {
  return (
    <label className="relative flex items-center gap-2 rounded-md border border-line px-2.5 py-2 text-[11.5px] font-medium text-cocoa">
      <span className="h-5 w-5 shrink-0 rounded-full border border-line" style={{ background: value ?? fallback }} />
      <span className="truncate">{label}</span>
      {value !== null && fallback && (
        <button type="button" className="relative z-10 ml-auto text-[10.5px] text-gold-deep" onClick={(e) => { e.preventDefault(); onChange(null); }}>
          Match
        </button>
      )}
      <input type="color" value={value ?? fallback ?? '#000000'} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={label} />
    </label>
  );
}
