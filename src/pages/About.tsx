import { Link } from 'react-router';
import { ArrowRight, Boxes, Check, Globe, Layers, MonitorSmartphone, Palette, ScanFace, Wand2 } from 'lucide-react';
import { Seo } from '../components/site/Seo';
import { Reveal, SectionHeading } from '../components/site/Reveal';

const B = import.meta.env.BASE_URL;

const CAPS = [
  {
    icon: Boxes,
    t: '3D Product Visualization',
    b: 'Products shoppers can rotate, zoom and inspect, with physically based metals, gems, fabrics and studio lighting.',
    points: ['GLB/glTF asset pipeline', 'PBR materials & HDRI lighting', 'Hotspots and exploded views'],
    demo: ['See the watch viewer', '/watches'],
  },
  {
    icon: ScanFace,
    t: 'Virtual Try-On Solutions',
    b: 'Camera or photo try-on that tracks the face and shoulders and places products in perspective, including occlusion behind the head and neck.',
    points: ['Face & pose tracking', 'Person segmentation for backgrounds', 'On-device processing'],
    demo: ['Try the jewellery studio', '/jewellery'],
  },
  {
    icon: Palette,
    t: 'Product Customization',
    b: 'Design tools where each choice updates the product immediately: colours, materials, text, logos and layers.',
    points: ['Layer editor with undo/redo', 'Print-ready export', 'Saved and shareable designs'],
    demo: ['Open the T-shirt studio', '/tshirt'],
  },
  {
    icon: Wand2,
    t: 'AI-Powered Visualization',
    b: 'Computer vision that understands the customer’s space or photo. On-device models keep images private, and cloud models can be added where a project needs them.',
    points: ['On-device segmentation', 'Perspective recovery from photos', 'Pluggable cloud model integration'],
    demo: ['Try the curtain visualizer', '/curtains'],
  },
  {
    icon: MonitorSmartphone,
    t: 'Interactive E-Commerce',
    b: 'Experiences embedded in your storefront, connected to your catalogue, pricing and cart.',
    points: ['Live pricing from options', 'Catalogue-driven configuration', 'Responsive on phones and laptops'],
  },
  {
    icon: Globe,
    t: 'WebGL Experiences',
    b: 'Scroll-driven stories, animated launches and interactive brand pages that run in the browser with no plugins.',
    points: ['Three.js & React Three Fiber', 'GSAP scroll choreography', 'Fallbacks for limited devices'],
  },
  {
    icon: Layers,
    t: 'Custom 3D Configurators',
    b: 'Rules, options and assets modelled around your product, so new items can be added without changing the rendering engine.',
    points: ['Parametric or artist-built models', 'Structured product data', 'Asset optimisation pipeline'],
  },
];

const STACK = [
  ['Rendering', 'Three.js, React Three Fiber, Drei, MeshPhysicalMaterial, HDRI environments, ACES tone mapping'],
  ['Computer vision', 'MediaPipe Face Landmarker, Pose Landmarker, selfie and interactive segmentation, running on the device'],
  ['3D assets', 'glTF/GLB, meshopt compression, parametric modelling, material libraries'],
  ['Motion', 'GSAP ScrollTrigger, Motion, respecting reduced-motion preferences'],
  ['Front end', 'React, TypeScript, Vite, Tailwind CSS, code-split routes and lazy-loaded assets'],
];

const PROCESS = [
  ['Discovery', 'We define what the experience should achieve and review your catalogue and existing assets.'],
  ['Prototype', 'A working prototype on one or two real products, so decisions are made in the browser.'],
  ['Asset production', 'We model or optimise your products and match materials to reference photos.'],
  ['Integration', 'We connect catalogue, pricing and cart, then test on the devices your customers use.'],
  ['Launch & handover', 'You get documentation and a pipeline for adding products yourself.'],
];

export default function About() {
  return (
    <>
      <Seo title="Our Capabilities" description="3D product visualization, virtual try-on, product customization, AI-powered visualization, interactive e-commerce, WebGL experiences and custom 3D configurators." path="/about" />
      <section className="grain bg-[radial-gradient(ellipse_at_80%_0%,#ffffff,#fbf8f3_50%,#f2ece2)]">
        <div className="container-lux py-16 lg:py-24">
          <p className="eyebrow">About · Our capabilities</p>
          <h1 className="display mt-5 max-w-5xl text-[52px] leading-[0.98] sm:text-7xl lg:text-[88px]">
            We make products <span className="text-gold italic">interactive.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-relaxed text-cocoa sm:text-lg">
            Cubiccode designs and engineers 3D experiences for e-commerce. Everything on this site runs live in your browser, as a working
            example of what we can build around your products.
          </p>
        </div>
      </section>

      <section className="bg-white py-20 lg:py-28">
        <div className="container-lux">
          <SectionHeading eyebrow="What we develop" title="Seven ways to bring a product to life" />
          <div className="mt-12 divide-y divide-line border-y border-line">
            {CAPS.map((c) => (
              <Reveal key={c.t} className="grid gap-6 py-9 lg:grid-cols-[1fr_1.1fr_1fr] lg:gap-10">
                <div className="flex items-start gap-4">
                  <c.icon className="mt-1.5 h-6 w-6 shrink-0 text-gold" strokeWidth={1.5} />
                  <h3 className="font-display text-[28px] leading-tight font-semibold">{c.t}</h3>
                </div>
                <div>
                  <p className="text-[15px] leading-relaxed text-cocoa">{c.b}</p>
                  {c.demo && (
                    <Link to={c.demo[1]} className="btn-link mt-3">
                      {c.demo[0]} <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
                <ul className="space-y-2">
                  {c.points.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-[13.5px] text-ink">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" /> {p}
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="process" className="scroll-mt-20 bg-cream py-20 lg:py-28">
        <div className="container-lux grid gap-12 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <SectionHeading eyebrow="How we work" title="Prototype early, ship with confidence" />
            <img src={`${B}showcase/watches.webp`} alt="A 3D chronograph rendered in the watch configurator" loading="lazy" className="mt-8 hidden aspect-[4/3] w-full rounded-lg border border-line bg-[radial-gradient(ellipse_at_50%_30%,#fff,#efe8dc)] object-contain lg:block" />
          </div>
          <ol className="space-y-px overflow-hidden rounded-xl border border-line bg-line">
            {PROCESS.map(([t, b], i) => (
              <Reveal as="li" key={t} delay={i * 0.05} className="flex gap-5 bg-white p-6">
                <span className="font-display text-3xl text-champagne">0{i + 1}</span>
                <span>
                  <span className="block text-[16px] font-semibold">{t}</span>
                  <span className="mt-1 block text-[14px] leading-relaxed text-cocoa">{b}</span>
                </span>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section id="tech" className="scroll-mt-20 bg-ivory py-20 lg:py-28">
        <div className="container-lux">
          <SectionHeading eyebrow="Technology" title="The stack behind these demos" />
          <Reveal className="panel mt-12 overflow-hidden">
            <dl className="divide-y divide-line-soft">
              {STACK.map(([k, v]) => (
                <div key={k} className="grid gap-1 px-6 py-5 sm:grid-cols-[200px_1fr] sm:gap-6">
                  <dt className="text-[14px] font-semibold text-ink">{k}</dt>
                  <dd className="text-[14px] leading-relaxed text-cocoa">{v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </section>
    </>
  );
}
