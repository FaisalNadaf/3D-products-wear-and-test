import { lazy, Suspense, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { ArrowRight, ArrowUpRight, Boxes, Check, Cpu, Glasses, Layers, MonitorSmartphone, Palette, ScanFace, ShieldCheck, Sofa, Sparkles, SplitSquareHorizontal, Watch, Wand2, Zap } from 'lucide-react';
import { Seo } from '../components/site/Seo';
import { InView, Reveal, SectionHeading } from '../components/site/Reveal';
import { EXPERIENCES, type Experience } from '../config/site';
import { WATCHES, findWatch } from '../config/watches';
import { TEE_COLORS } from '../features/tshirt/design';

const B = import.meta.env.BASE_URL;
const WatchViewer = lazy(() => import('../features/watch/WatchViewer').then((m) => ({ default: m.WatchViewer })));
const Product3DViewer = lazy(() => import('../components/viewer/Product3DViewer').then((m) => ({ default: m.Product3DViewer })));
const TeePreview = lazy(() => import('../components/site/TeePreview').then((m) => ({ default: m.TeePreview })));

const Shimmer = () => <div className="shimmer h-full w-full" />;

export default function Home() {
  return (
    <>
      <Seo title="Cubiccode" description="Discover immersive 3D product visualization and customization experiences: virtual jewellery try-on, a luxury watch configurator, a T-shirt designer and a curtain visualizer." path="/" />
      <Hero />
      <Trust />
      <JewellerySection />
      <WatchSection />
      <TeeSection />
      <CurtainSection />
      <Capabilities />
      <HowItWorks />
      <Industries />
      <WhyUs />
      <Inquiry />
    </>
  );
}

/* ───────────────────────────── hero */

function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 90]);
  const heroWatch = findWatch('regent-automatic');
  const heroSpec = useMemo(() => ({ ...heroWatch.defaults, strap: 'leather' as const, strapColor: '#5a3421' }), [heroWatch]);
  const noop = () => undefined;
  return (
    <section ref={ref} className="grain relative overflow-hidden bg-[radial-gradient(ellipse_90%_70%_at_75%_30%,#ffffff_0%,#fbf8f3_45%,#f2ece2_100%)]">
      <div className="container-lux grid min-h-[calc(100svh-76px)] grid-cols-[minmax(0,1fr)] items-center gap-6 py-10 lg:grid-cols-[1fr_1.1fr] lg:py-0">
        <motion.div initial={reduce ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} className="relative z-10">
          <p className="eyebrow">Interactive 3D product studio</p>
          <h1 className="display mt-5 text-[52px] leading-[0.96] sm:text-7xl xl:text-[92px]">
            Experience Products <span className="text-gold italic">Beyond Reality.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-cocoa sm:text-lg">
            Discover immersive 3D product visualization and customization experiences designed to bring your ideas to life.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#experiences" className="btn-primary px-6">
              Explore Our Experiences <ArrowRight className="h-4 w-4" />
            </a>
            <Link to="/contact" className="btn-ghost px-6">
              Contact Us
            </Link>
          </div>
        </motion.div>
        <motion.div style={{ y }} initial={reduce ? false : { opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2, delay: 0.15, ease: [0.22, 1, 0.36, 1] }} className="relative h-[52svh] min-h-[340px] lg:h-[82svh]">
          <div className="pointer-events-none absolute inset-0 lg:pointer-events-auto">
            <Suspense fallback={null}>
              <WatchViewer product={heroWatch} spec={heroSpec} explode={0} autoRotate hotspots={false} activeHotspot={null} onHotspot={noop} zoomable={false} />
            </Suspense>
          </div>
          <p className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 rounded-full border border-line bg-white/85 px-3.5 py-1.5 text-[11px] font-semibold text-cocoa backdrop-blur lg:block">
            Live 3D. Drag to rotate.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

function Trust() {
  const items = [
    ['Real-time WebGL', 'Runs in any modern browser'],
    ['On-device AI', 'Camera & photos stay private'],
    ['No app to install', 'Works on desktop and mobile'],
    ['Your catalogue', 'Configured, not hard-coded'],
  ];
  return (
    <section className="border-y border-line bg-white">
      <ul className="container-lux grid grid-cols-2 gap-y-6 py-8 lg:grid-cols-4">
        {items.map(([t, b]) => (
          <li key={t} className="pr-4">
            <p className="font-display text-xl font-semibold text-ink">{t}</p>
            <p className="mt-0.5 text-[13px] text-muted">{b}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ───────────────────────────── showcase layout */

function Showcase({ exp, index, tone, visual, title, children }: { exp: Experience; index: number; tone: string; visual: ReactNode; title: ReactNode; children?: ReactNode }) {
  const flip = index % 2 === 1;
  return (
    <section id={index === 0 ? 'experiences' : undefined} className={`${tone} scroll-mt-20 py-20 lg:py-28`}>
      <div className="container-lux grid grid-cols-[minmax(0,1fr)] items-center gap-10 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
        <Reveal className={flip ? 'lg:order-2' : ''}>{visual}</Reveal>
        <Reveal delay={0.1} className={flip ? 'lg:order-1' : ''}>
          <p className="eyebrow">0{index + 1} · {exp.short}</p>
          <h2 className="display mt-4 text-[40px] leading-[1.02] sm:text-5xl lg:text-[58px]">{title}</h2>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-cocoa sm:text-base">{exp.description}</p>
          <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
            {exp.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-[13.5px] text-ink">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" /> {f}
              </li>
            ))}
          </ul>
          {children}
          <Link to={exp.path} className="btn-primary mt-8 px-6">
            Explore Experience <ArrowRight className="h-4 w-4" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

function JewellerySection() {
  const pieces = [
    { id: 'jhumka-temple', label: 'Jhumkas' },
    { id: 'drop-sapphire-halo', label: 'Sapphire drops' },
    { id: 'chandbali-kundan', label: 'Chandbali' },
  ] as const;
  const [p, setP] = useState<(typeof pieces)[number]['id']>('jhumka-temple');
  return (
    <Showcase
      exp={EXPERIENCES[0]}
      index={0}
      tone="bg-ivory"
      title={
        <>
          Virtual Jewellery <span className="text-gold italic">Try-On</span>
        </>
      }
      visual={
        <div className="relative aspect-[4/3.4] overflow-hidden rounded-xl border border-line shadow-lift">
          <InView className="h-full w-full" fallback={<Shimmer />}>
            <Suspense fallback={<Shimmer />}>
              <Product3DViewer pieces={[p]} label="Jewellery" minimal />
            </Suspense>
          </InView>
          <div className="absolute inset-x-4 bottom-4 flex flex-wrap gap-1.5">
            {pieces.map((x) => (
              <button key={x.id} onClick={() => setP(x.id)} aria-pressed={p === x.id} className={p === x.id ? 'chip-on' : 'chip'}>
                {x.label}
              </button>
            ))}
          </div>
        </div>
      }
    />
  );
}

function WatchSection() {
  const choices = ['regent-automatic', 'sovereign-gold', 'abyss-diver', 'phantom-skeleton', 'aegis-steel', 'aviator-leather'];
  const [w, setW] = useState(choices[1]);
  return (
    <Showcase
      exp={EXPERIENCES[1]}
      index={1}
      tone="bg-cream"
      title={
        <>
          Luxury 3D Watch <span className="text-gold italic">Customization</span>
        </>
      }
      visual={
        <div className="overflow-hidden rounded-xl border border-line bg-[radial-gradient(ellipse_at_50%_30%,#ffffff,#efe8dc)] shadow-lift">
          <div className="relative aspect-[4/3.1]">
            {choices.map((id) => (
              <img key={id} src={`${B}watches/thumbs/${id}.webp`} alt={findWatch(id).name} loading="lazy" className={`absolute inset-0 h-full w-full object-contain p-4 transition-all duration-700 ease-[var(--ease-lux)] ${w === id ? 'scale-100 opacity-100' : 'scale-[0.97] opacity-0'}`} />
            ))}
            <span className="absolute top-4 left-4 rounded-md border border-line bg-white/90 px-3 py-1.5 text-[12px] font-semibold backdrop-blur">{findWatch(w).name}</span>
          </div>
          <div className="scrollbar-none flex gap-1.5 overflow-x-auto border-t border-line bg-white p-3">
            {choices.map((id) => (
              <button key={id} onClick={() => setW(id)} onMouseEnter={() => setW(id)} aria-pressed={w === id} className={w === id ? 'chip-on' : 'chip'}>
                {WATCHES.find((x) => x.id === id)?.collection}
              </button>
            ))}
          </div>
        </div>
      }
    />
  );
}

function TeeSection() {
  const [color, setColor] = useState('#2a4f9a');
  return (
    <Showcase
      exp={EXPERIENCES[2]}
      index={2}
      tone="bg-white"
      title={
        <>
          Interactive T&#8209;Shirt <span className="text-gold italic">Designer</span>
        </>
      }
      visual={
        <div className="relative aspect-[4/3.4] overflow-hidden rounded-xl border border-line bg-[radial-gradient(ellipse_at_50%_30%,#fdfbf7,#ebe4d8)] shadow-lift">
          <InView className="h-full w-full" fallback={<Shimmer />}>
            <Suspense fallback={<Shimmer />}>
              <TeePreview color={color} />
            </Suspense>
          </InView>
          <div className="absolute inset-x-4 bottom-4 flex flex-wrap items-center gap-2 rounded-md border border-line bg-white/92 p-2 backdrop-blur" role="group" aria-label="Try a garment colour">
            <span className="px-1 text-[11px] font-semibold text-muted">Try a colour</span>
            {TEE_COLORS.slice(0, 7).map((c) => (
              <button key={c.id} onClick={() => setColor(c.id)} aria-label={c.label} aria-pressed={color === c.id} className={`h-7 w-7 rounded-full border-2 ${color === c.id ? 'border-ink' : 'border-white shadow-[0_0_0_1px_var(--color-line)]'}`} style={{ background: c.id }} />
            ))}
          </div>
        </div>
      }
    />
  );
}

function CurtainSection() {
  const [v, setV] = useState(58);
  return (
    <Showcase
      exp={EXPERIENCES[3]}
      index={3}
      tone="bg-cream"
      title={
        <>
          AI&#8209;Assisted Curtain <span className="text-gold italic">Visualization</span>
        </>
      }
      visual={
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-line shadow-lift">
          <img src={`${B}showcase/curtains.webp`} alt="Room with rendered linen curtains" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          <img src={`${B}rooms/warm-living-room-twin-windows.webp`} alt="The same room before curtains" loading="lazy" className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 0 0 ${v}%)` }} />
          <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${v}%` }}>
            <span className="absolute top-1/2 left-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow-lift">
              <SplitSquareHorizontal className="h-4 w-4" />
            </span>
          </div>
          <span className="pointer-events-none absolute top-3 left-3 rounded bg-white/90 px-2 py-1 text-[11px] font-semibold">After</span>
          <span className="pointer-events-none absolute top-3 right-3 rounded bg-white/90 px-2 py-1 text-[11px] font-semibold">Before</span>
          <input type="range" min={0} max={100} value={v} onChange={(e) => setV(+e.target.value)} className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" aria-label="Compare before and after" />
        </div>
      }
    />
  );
}

/* ───────────────────────────── capabilities */

const CAPS = [
  { icon: Boxes, t: '3D product visualization', b: 'Inspectable products with physically based materials and studio lighting.' },
  { icon: ScanFace, t: 'Virtual try-on', b: 'Face and body tracking that places products on the shopper, live.' },
  { icon: Palette, t: 'Product customization', b: 'Options that update the 3D model immediately and carry through to the order.' },
  { icon: Wand2, t: 'AI-powered visualization', b: 'On-device segmentation, or your choice of cloud model behind a clean API.' },
  { icon: Layers, t: 'Custom 3D configurators', b: 'Rules, pricing and asset pipelines built around your catalogue.' },
  { icon: MonitorSmartphone, t: 'Interactive e-commerce', b: 'Experiences that sit inside your storefront, on any device.' },
];

function Capabilities() {
  return (
    <section className="bg-ivory py-20 lg:py-28">
      <div className="container-lux">
        <SectionHeading eyebrow="Our capabilities" title="What we build" body="Each demo on this site is a working example of something we can adapt to your product line." />
        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {CAPS.map((c, i) => (
            <Reveal key={c.t} delay={i * 0.05} className="group bg-white p-7 transition-colors hover:bg-cream">
              <c.icon className="h-6 w-6 text-gold" strokeWidth={1.5} />
              <h3 className="mt-5 font-display text-2xl font-semibold">{c.t}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-cocoa">{c.b}</p>
            </Reveal>
          ))}
        </div>
        <Link to="/about" className="btn-link mt-8">
          See all capabilities <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    ['Discover', 'We look at your products, your storefront and what shoppers need to see before they buy.'],
    ['Model', 'We build or optimise 3D assets, with materials matched to the real product.'],
    ['Build', 'We develop the experience, connect your catalogue and tune it for phones and laptops.'],
    ['Launch', 'We embed it in your store, test it on real devices and hand over the asset pipeline.'],
  ];
  return (
    <section className="bg-white py-20 lg:py-28">
      <div className="container-lux">
        <SectionHeading eyebrow="How it works" title="From catalogue to live experience" />
        <ol className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map(([t, b], i) => (
            <Reveal as="li" key={t} delay={i * 0.08} className="border-t border-ink pt-5">
              <span className="font-display text-3xl text-champagne">0{i + 1}</span>
              <h3 className="mt-3 text-[16px] font-semibold">{t}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-cocoa">{b}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

const INDUSTRIES = [
  { t: 'Jewellery', img: 'jeweller-workbench', alt: 'A jeweller working at a bench', to: '/jewellery', icon: Sparkles },
  { t: 'Watches & luxury', img: 'watch-on-leather', alt: 'A wristwatch resting on leather', to: '/watches', icon: Watch },
  { t: 'Fashion & apparel', img: 'folded-tshirts', alt: 'A stack of folded T-shirts', to: '/tshirt', icon: Layers },
  { t: 'Home & interiors', img: 'linen-curtain-living-room', alt: 'A living room with linen curtains', to: '/curtains', icon: Sofa },
  { t: 'Furniture', img: 'armchair-minimal-interior', alt: 'A designer armchair in a bright room', to: '/contact', icon: Boxes },
  { t: 'Eyewear & beauty', img: 'eyewear-display', alt: 'A display of sunglasses', to: '/contact', icon: Glasses },
];

function Industries() {
  return (
    <section id="industries" className="scroll-mt-20 bg-cream py-20 lg:py-28">
      <div className="container-lux">
        <SectionHeading eyebrow="Industries we serve" title="Built for products people want to see up close" />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {INDUSTRIES.map((x, i) => (
            <Reveal key={x.t} delay={i * 0.05}>
              <Link to={x.to} className="group relative block aspect-[4/3] overflow-hidden rounded-lg bg-pearl">
                <picture>
                  <source type="image/webp" srcSet={`${B}industries/${x.img}-640w.webp 640w, ${B}industries/${x.img}-1024w.webp 1024w`} sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" />
                  <img src={`${B}industries/${x.img}-1024w.jpg`} alt={x.alt} width={1024} height={768} loading="lazy" className="h-full w-full object-cover transition-transform duration-[1200ms] ease-[var(--ease-lux)] group-hover:scale-105" />
                </picture>
                <span className="absolute inset-0 bg-linear-to-t from-black/55 via-black/5 to-transparent" />
                <span className="absolute inset-x-5 bottom-4 flex items-center justify-between text-white">
                  <span className="font-display text-2xl font-semibold">{x.t}</span>
                  <ArrowUpRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhyUs() {
  const items = [
    { icon: Zap, t: 'Fast on real devices', b: 'Assets are compressed and lazy-loaded, and each experience loads only when it’s opened.' },
    { icon: ShieldCheck, t: 'Private by design', b: 'Try-on and room photos are processed in the browser, not uploaded.' },
    { icon: Cpu, t: 'Standard, open technology', b: 'Three.js, WebGL and GLB. No plugins, and no lock-in to a proprietary viewer.' },
    { icon: Layers, t: 'Easy to extend', b: 'Products live in config files, so new items don’t touch the rendering engine.' },
  ];
  return (
    <section className="bg-ivory py-20 lg:py-28">
      <div className="container-lux grid gap-12 lg:grid-cols-[1fr_1.3fr]">
        <SectionHeading eyebrow="Why choose our technology" title="Impressive, and practical to run" />
        <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {items.map((x, i) => (
            <Reveal key={x.t} delay={i * 0.06}>
              <x.icon className="h-5 w-5 text-gold" strokeWidth={1.6} />
              <h3 className="mt-3 text-[16px] font-semibold">{x.t}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-cocoa">{x.b}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Inquiry() {
  return (
    <section className="bg-white py-20 lg:py-28">
      <Reveal className="container-lux">
        <div className="relative overflow-hidden rounded-xl border border-line bg-[radial-gradient(ellipse_at_80%_10%,#ffffff,#f4ecdd_60%,#eadcc2)] px-6 py-14 sm:px-14 lg:py-20">
          <p className="eyebrow">Project inquiry</p>
          <h2 className="display mt-4 max-w-3xl text-[40px] leading-[1.02] sm:text-6xl">Tell us about your product. We’ll show you what’s possible.</h2>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-cocoa">Share a few details and we’ll suggest the approach that suits your catalogue and budget.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/contact" className="btn-primary px-6">
              Start a project <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/about" className="btn-ghost px-6">
              See our capabilities
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
