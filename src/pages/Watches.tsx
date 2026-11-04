import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Camera, Check, ChevronDown, ChevronRight, Layers, Link2, Maximize2, Minimize2, RotateCcw, Rotate3d, ShoppingBag, X } from 'lucide-react';
import { Seo } from '../components/site/Seo';
import { InView, Reveal, SectionHeading } from '../components/site/Reveal';
import { useFullscreen } from '../hooks/useFullscreen';
import { useShop } from '../state/shop';
import { formatPrice } from '../config/catalog';
import {
  ACCENTS,
  BEZELS,
  BEZEL_COLORS,
  DIAL_COLORS,
  DIAL_FINISHES,
  HANDS,
  LUMES,
  MARKERS,
  METALS,
  STRAPS,
  STRAP_COLORS,
  WATCHES,
  findWatch,
  watchPrice,
  type OptionGroup,
  type WatchProduct,
  type WatchSpec,
} from '../config/watches';
import { CAMERA_PRESETS, WatchViewer, type HotspotId, type WatchViewerHandle } from '../features/watch/WatchViewer';

gsap.registerPlugin(ScrollTrigger);

const HOTSPOTS: Record<HotspotId, { title: string; body: string }> = {
  crown: { title: 'Screw-down crown', body: 'A knurled, screw-down crown seals the case, sets the time and winds the movement.' },
  bezel: { title: 'Bezel', body: 'Polished, fluted, ceramic diver, tachymeter or diamond-set. Each option is modelled in 3D.' },
  dial: { title: 'Dial', body: 'Sunray, matte, enamel or skeleton finishes. The sunray uses anisotropic reflections, so the highlight sweeps across the dial as you turn it.' },
  crystal: { title: 'Sapphire crystal', body: 'A domed sapphire crystal with refraction and an anti-reflective tint, rendered as transmissive glass.' },
  strap: { title: 'Strap & clasp', body: 'Three-link, five-link, leather, rubber, Milanese mesh or NATO, each draped over the display cushion.' },
  caseback: { title: 'Caseback', body: 'A solid caseback or a sapphire exhibition window that shows the rotor, gear train and balance wheel.' },
};

const encode = (s: WatchSpec) => btoa(JSON.stringify(s));
const decode = (v: string | null): Partial<WatchSpec> | null => {
  if (!v) return null;
  try {
    return JSON.parse(atob(v));
  } catch {
    return null;
  }
};

export default function Watches() {
  const [params, setParams] = useSearchParams();
  const [product, setProduct] = useState<WatchProduct>(() => findWatch(params.get('model') ?? 'regent-automatic'));
  const [spec, setSpec] = useState<WatchSpec>(() => ({ ...product.defaults, ...(decode(params.get('c')) ?? {}) }));
  const [explode, setExplode] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);
  // ?clean=1 hides overlays (used to render collection thumbnails)
  const clean = params.get('clean') === '1';
  const [hotspots, setHotspots] = useState(!clean);
  const [active, setActive] = useState<HotspotId | null>(null);
  const [copied, setCopied] = useState(false);
  const viewer = useRef<WatchViewerHandle>(null);
  const stage = useRef<HTMLDivElement>(null);
  const fs = useFullscreen(stage);
  const { addToBag, notify } = useShop();
  const price = watchPrice(product, spec);

  const choose = useCallback((w: WatchProduct) => {
    setProduct(w);
    setSpec(w.defaults);
    setExplode(0);
    setActive(null);
  }, []);
  useEffect(() => {
    setParams({ model: product.id }, { replace: true });
  }, [product.id, setParams]);
  const set = <K extends keyof WatchSpec>(k: K, v: WatchSpec[K]) => setSpec((s) => ({ ...s, [k]: v }));
  const has = (g: OptionGroup) => product.options.includes(g);

  const share = async () => {
    const url = `${location.origin}${location.pathname}?model=${product.id}&c=${encode(spec)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      notify('Configuration link copied');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      notify('Copy failed: your browser blocked clipboard access');
    }
  };
  const download = () => {
    const url = viewer.current?.capture();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `cubiccode-${product.id}.png`;
    a.click();
  };

  return (
    <>
      <Seo
        title="3D Watch Configurator"
        description="A luxury 3D watch configurator: case metals, dials, bezels, hands, markers and straps update in real time, with hotspots, camera presets and an exploded view."
        path="/watches"
      />
      <section className="bg-ivory">
        <div className="container-lux pt-6 sm:pt-10">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12px] text-muted">
            <Link to="/" className="hover:text-ink">
              Home
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span>Experiences</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-ink">3D Watches</span>
          </nav>
          <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="eyebrow">Watch Atelier · Configurator</p>
              <h1 className="display mt-3 text-[44px] leading-[0.98] sm:text-6xl lg:text-[72px]">
                Build a watch <span className="text-gold italic">in 3D</span>
              </h1>
            </div>
            <p className="max-w-md text-[15px] leading-relaxed text-cocoa">
              Nine models from chronograph to skeleton. Every metal, dial, bezel, hand and strap choice updates the 3D model
              immediately.
            </p>
          </div>

          {/* collection rail */}
          <div className="scrollbar-none -mx-4 mt-8 flex gap-2.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0" role="tablist" aria-label="Watch collection">
            {WATCHES.map((w) => (
              <button
                key={w.id}
                role="tab"
                aria-selected={w.id === product.id}
                onClick={() => choose(w)}
                className={`group shrink-0 overflow-hidden rounded-lg border bg-white text-left transition-all duration-300 ${
                  w.id === product.id ? 'border-ink shadow-lift' : 'border-line hover:border-champagne'
                }`}
              >
                <span className="block h-[92px] w-[150px] bg-[radial-gradient(ellipse_at_50%_40%,#fff,#efe8dc)]">
                  <img src={`${import.meta.env.BASE_URL}watches/thumbs/${w.id}.webp`} alt="" loading="lazy" className="h-full w-full object-contain p-1.5 transition-transform duration-500 group-hover:scale-105" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
                </span>
                <span className="block border-t border-line-soft px-3 py-2">
                  <span className="block text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">{w.style}</span>
                  <span className="block truncate text-[13px] font-semibold text-ink">{w.name}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="container-lux mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div ref={stage} className={`relative overflow-hidden ${fs.isFullscreen ? (fs.pseudo ? 'fixed inset-0 z-[55]' : 'h-full w-full') : 'rounded-xl border border-line'} bg-[radial-gradient(ellipse_at_50%_30%,#ffffff_0%,#f6f1e8_55%,#e9e0d1_100%)]`}>
          <div className={fs.isFullscreen ? 'h-[100dvh]' : 'aspect-[4/4.2] sm:aspect-[4/3] lg:aspect-auto lg:h-[min(76vh,720px)]'}>
            <WatchViewer
              ref={viewer}
              product={product}
              spec={spec}
              explode={explode}
              autoRotate={autoRotate}
              hotspots={hotspots}
              activeHotspot={active}
              onHotspot={(h) => setActive((a) => (a === h ? null : h))}
            />
          </div>
          {/* top bar */}
          <div data-overlay hidden={clean} className="absolute top-3 left-3 flex flex-wrap gap-1.5 sm:top-4 sm:left-4">
            <span className="rounded-md border border-line bg-white/90 px-3 py-1.5 text-[12px] font-semibold text-ink backdrop-blur">
              {product.name} · <span className="text-gold-deep">{formatPrice(price)}</span>
            </span>
          </div>
          <div hidden={clean} className="absolute top-3 right-3 flex gap-1.5 sm:top-4 sm:right-4">
            <IconBtn label="Download render" onClick={download}>
              <Camera className="h-4 w-4" />
            </IconBtn>
            <IconBtn label={fs.isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} onClick={fs.toggle}>
              {fs.isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </IconBtn>
          </div>
          {/* hotspot card */}
          <AnimatePresence>
            {active && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute top-16 left-3 z-10 w-[min(300px,calc(100%-24px))] rounded-lg border border-line bg-white/96 p-4 shadow-lift backdrop-blur sm:left-4"
                role="dialog"
                aria-label={HOTSPOTS[active].title}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-display text-xl font-semibold">{HOTSPOTS[active].title}</p>
                  <button onClick={() => setActive(null)} aria-label="Close" className="-m-1 rounded p-1 text-muted hover:text-ink">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-cocoa">{HOTSPOTS[active].body}</p>
              </motion.div>
            )}
          </AnimatePresence>
          {/* bottom controls */}
          <div hidden={clean} className="absolute inset-x-3 bottom-3 flex flex-col gap-2 sm:inset-x-4 sm:bottom-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="scrollbar-none flex gap-1 overflow-x-auto rounded-md border border-line bg-white/92 p-1 backdrop-blur">
              {CAMERA_PRESETS.map((p) => (
                <button key={p.id} onClick={() => viewer.current?.preset(p.id)} className="shrink-0 rounded-[7px] px-3 py-2 text-[12px] font-semibold text-cocoa transition-colors hover:bg-cream hover:text-ink">
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <ToggleBtn on={explode > 0} onClick={() => setExplode((e) => (e > 0 ? 0 : 1))} icon={<Layers className="h-4 w-4" />} label="Exploded view" />
              <ToggleBtn on={autoRotate} onClick={() => setAutoRotate((a) => !a)} icon={<Rotate3d className="h-4 w-4" />} label="Rotate" />
              <ToggleBtn on={hotspots} onClick={() => setHotspots((h) => !h)} icon={<span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-current text-[8px] font-bold">1</span>} label="Hotspots" />
            </div>
          </div>
        </div>

        <Configurator product={product} spec={spec} set={set} has={has} price={price} onReset={() => setSpec(product.defaults)} onShare={share} copied={copied} onAdd={() => addToBag(`${product.id}`, product.name)} />
      </section>

      <WatchStory product={product} spec={spec} />

      <section className="bg-cream py-20">
        <div className="container-lux grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <SectionHeading eyebrow="Specifications" title={product.name} body={product.description} />
          <Reveal className="panel overflow-hidden">
            <dl className="divide-y divide-line-soft">
              {[...product.specs, ['Case metal', METALS.find((m) => m.id === spec.caseMetal)!.label], ['Strap', STRAPS.find((s) => s.id === spec.strap)!.label]].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[150px_1fr] gap-4 px-6 py-4 text-sm">
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </section>
    </>
  );
}

function IconBtn({ children, label, onClick }: { children: ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="flex h-10 w-10 items-center justify-center rounded-md border border-line bg-white/92 text-ink backdrop-blur transition-colors hover:border-ink">
      {children}
    </button>
  );
}
function ToggleBtn({ on, onClick, icon, label }: { on: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`flex h-10 items-center gap-1.5 rounded-md border px-3 text-[12px] font-semibold backdrop-blur transition-colors ${on ? 'border-ink bg-ink text-ivory' : 'border-line bg-white/92 text-ink hover:border-ink'}`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/* ───────────────────────────────────────────── configurator panel */

function Configurator({
  product,
  spec,
  set,
  has,
  price,
  onReset,
  onShare,
  copied,
  onAdd,
}: {
  product: WatchProduct;
  spec: WatchSpec;
  set: <K extends keyof WatchSpec>(k: K, v: WatchSpec[K]) => void;
  has: (g: OptionGroup) => boolean;
  price: number;
  onReset: () => void;
  onShare: () => void;
  copied: boolean;
  onAdd: () => void;
}) {
  const fixed = product.source.kind === 'glb';
  return (
    <aside className="panel flex flex-col lg:h-[min(76vh,720px)]">
      <div className="border-b border-line-soft p-5">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">{product.style}</p>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <h2 className="display text-[30px] leading-tight">{product.name}</h2>
          <button onClick={onReset} className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-gold-deep hover:text-ink">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">{product.highlights.join(' · ')}</p>
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
        {has('caseMetal') && (
          <Group title="Case material" value={METALS.find((m) => m.id === spec.caseMetal)?.label} open>
            <div className="grid grid-cols-3 gap-2">
              {METALS.map((m) => (
                <SwatchCard key={m.id} label={m.label} bg={m.swatch} on={spec.caseMetal === m.id} onClick={() => set('caseMetal', m.id)} />
              ))}
            </div>
          </Group>
        )}
        {has('dialColor') && (
          <Group title="Dial" value={DIAL_COLORS.find((d) => d.id === spec.dialColor)?.label ?? 'Custom'} open>
            <Swatches list={DIAL_COLORS} value={spec.dialColor} onChange={(v) => set('dialColor', v)} />
            {has('dialFinish') && <Chips list={DIAL_FINISHES} value={spec.dialFinish} onChange={(v) => set('dialFinish', v)} />}
          </Group>
        )}
        {(has('bezel') || has('bezelColor')) && (
          <Group title="Bezel" value={has('bezel') ? BEZELS.find((b) => b.id === spec.bezel)?.label : BEZEL_COLORS.find((b) => b.id === spec.bezelColor)?.label}>
            {has('bezel') && <Chips list={BEZELS} value={spec.bezel} onChange={(v) => set('bezel', v)} />}
            {(spec.bezel === 'diver' || spec.bezel === 'tachymeter' || !has('bezel')) && <Swatches list={BEZEL_COLORS} value={spec.bezelColor} onChange={(v) => set('bezelColor', v)} />}
          </Group>
        )}
        {has('hands') && (
          <Group title="Hands" value={HANDS.find((h) => h.id === spec.hands)?.label}>
            <Chips list={HANDS} value={spec.hands} onChange={(v) => set('hands', v)} />
          </Group>
        )}
        {has('markers') && (
          <Group title="Hour markers" value={MARKERS.find((m) => m.id === spec.markers)?.label}>
            <Chips list={MARKERS} value={spec.markers} onChange={(v) => set('markers', v)} />
          </Group>
        )}
        {has('strap') && (
          <Group title="Strap" value={STRAPS.find((s) => s.id === spec.strap)?.label}>
            <Chips list={STRAPS} value={spec.strap} onChange={(v) => set('strap', v)} />
            {['leather', 'rubber', 'nato'].includes(spec.strap) && <Swatches list={STRAP_COLORS} value={spec.strapColor} onChange={(v) => set('strapColor', v)} />}
            {(spec.strap === 'bracelet' || spec.strap === 'jubilee') && has('twoTone') && <Toggle label="Two-tone gold centre links" on={spec.twoTone} onChange={(v) => set('twoTone', v)} />}
          </Group>
        )}
        {(has('lume') || has('accent') || has('date') || has('exhibitionBack')) && (
          <Group title="Details" value="Lume, accent & complications">
            {has('lume') && (
              <>
                <p className="label mt-1">Luminous colour</p>
                <Swatches list={LUMES} value={spec.lume} onChange={(v) => set('lume', v)} />
              </>
            )}
            {has('accent') && (
              <>
                <p className="label mt-3">Seconds hand</p>
                <Chips list={ACCENTS} value={spec.accent} onChange={(v) => set('accent', v)} />
              </>
            )}
            {has('date') && <Toggle label="Date window" on={spec.date} onChange={(v) => set('date', v)} />}
            {has('exhibitionBack') && <Toggle label="Sapphire exhibition caseback" on={spec.exhibitionBack} onChange={(v) => set('exhibitionBack', v)} />}
          </Group>
        )}
        {fixed && <p className="px-2 pt-2 text-[12px] leading-relaxed text-muted">The reference chronograph has a fixed hand and marker design. The other eight models can be customised in every option.</p>}
      </div>
      <div className="border-t border-line-soft p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] text-muted">Your configuration</span>
          <span className="text-xl font-bold text-gold-deep">{formatPrice(price)}</span>
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={onAdd} className="btn-primary flex-1">
            <ShoppingBag className="h-4 w-4" /> Add to bag
          </button>
          <button onClick={onShare} className="btn-ghost px-3.5" aria-label="Copy configuration link" title="Copy configuration link">
            {copied ? <Check className="h-4 w-4 text-success" /> : <Link2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
}

function Group({ title, value, children, open = false }: { title: string; value?: string; children: ReactNode; open?: boolean }) {
  const [o, setO] = useState(open);
  return (
    <div className="rounded-lg border border-transparent px-2 transition-colors hover:border-line-soft">
      <button onClick={() => setO(!o)} className="flex w-full items-center justify-between gap-3 py-3 text-left" aria-expanded={o}>
        <span>
          <span className="block text-[13.5px] font-semibold text-ink">{title}</span>
          {value && <span className="block text-[12px] text-muted">{value}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 text-muted transition-transform duration-300 ${o ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {o && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
            <div className="space-y-3 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SwatchCard({ label, bg, on, onClick }: { label: string; bg: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={on} className={`rounded-md border p-2 text-left transition-all ${on ? 'border-ink ring-2 ring-ink/10' : 'border-line hover:border-champagne'}`}>
      <span className="block h-8 rounded-[5px]" style={{ background: bg }} />
      <span className="mt-1.5 block text-[11px] leading-tight font-semibold text-ink">{label}</span>
    </button>
  );
}
function Swatches({ list, value, onChange }: { list: { id: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {list.map((c) => (
        <button
          key={c.id}
          onClick={() => onChange(c.id)}
          title={c.label}
          aria-label={c.label}
          aria-pressed={value === c.id}
          className={`h-9 w-9 rounded-full border-2 transition-transform hover:scale-105 ${value === c.id ? 'border-ink' : 'border-white shadow-[0_0_0_1px_var(--color-line)]'}`}
          style={{ background: c.id === 'none' ? 'linear-gradient(135deg,#eee,#bbb)' : c.id }}
        />
      ))}
    </div>
  );
}
function Chips<T extends string>({ list, value, onChange }: { list: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((c) => (
        <button key={c.id} onClick={() => onChange(c.id)} aria-pressed={value === c.id} className={value === c.id ? 'chip-on' : 'chip'}>
          {c.label}
        </button>
      ))}
    </div>
  );
}
function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mt-2 flex cursor-pointer items-center justify-between gap-3 rounded-md border border-line-soft px-3 py-2.5 text-[13px] font-medium text-ink">
      {label}
      <button role="switch" aria-checked={on} onClick={() => onChange(!on)} className={`relative h-6 w-10 rounded-full transition-colors ${on ? 'bg-ink' : 'bg-sand'}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? 'left-5' : 'left-1'}`} />
      </button>
    </label>
  );
}

/* ───────────────────────────────────────────── scroll story */

const STORY = [
  { k: 'Case', t: 'Machined, then hand-finished', b: 'The case has polished bevels and brushed flanks. Each surface uses its own PBR roughness, so the two finishes catch light differently.' },
  { k: 'Movement', t: 'A movement you can see', b: 'Scroll on to pull the watch apart: crystal, bezel, hands, dial and gear train separate along the case axis.' },
  { k: 'Dial', t: 'Light moves across it', b: 'The sunray dial uses anisotropic reflections, and the sapphire crystal refracts what sits beneath it.' },
  { k: 'Strap', t: 'Draped, not pasted', b: 'Straps are swept along a path that follows the display cushion, with leather grain and stitching modelled as surface detail.' },
];

function WatchStory({ product, spec }: { product: WatchProduct; spec: WatchSpec }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const st = ScrollTrigger.create({ trigger: el, start: 'top top', end: 'bottom bottom', scrub: 0.6, onUpdate: (s) => setP(s.progress) });
    return () => st.kill();
  }, []);
  const step = Math.min(STORY.length - 1, Math.floor(p * STORY.length));
  const explode = Math.max(0, Math.min(1, (p - 0.22) / 0.3)) * (p < 0.78 ? 1 : Math.max(0, 1 - (p - 0.78) / 0.15));
  const orbit = useMemo(() => p * Math.PI * 1.6 - 0.6, [p]);
  return (
    <section ref={wrap} className="relative mt-20 h-[340vh] bg-white" aria-label="Watch anatomy">
      <div className="sticky top-0 grid h-screen grid-cols-[minmax(0,1fr)] items-center lg:grid-cols-[0.9fr_1.1fr]">
        <div className="container-lux relative z-10 lg:pr-0">
          <p className="eyebrow">Anatomy · scroll to explore</p>
          <div className="mt-4 h-[230px]">
            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.45 }}>
                <p className="font-display text-lg text-champagne">0{step + 1} · {STORY[step].k}</p>
                <h2 className="display mt-2 text-4xl leading-[1.02] sm:text-5xl">{STORY[step].t}</h2>
                <p className="mt-4 max-w-md text-[15px] leading-relaxed text-cocoa">{STORY[step].b}</p>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="mt-6 flex gap-2">
            {STORY.map((s, i) => (
              <span key={s.k} className={`h-1 rounded-full transition-all duration-500 ${i === step ? 'w-10 bg-ink' : 'w-4 bg-sand'}`} />
            ))}
          </div>
        </div>
        <InView className="absolute inset-0 lg:relative lg:h-[80vh]" rootMargin="400px">
          <div className="h-full w-full opacity-30 lg:opacity-100">
            <WatchViewer product={product} spec={spec} explode={explode} autoRotate={false} hotspots={false} activeHotspot={null} onHotspot={() => {}} interactive={false} orbit={orbit} />
          </div>
        </InView>
      </div>
    </section>
  );
}
