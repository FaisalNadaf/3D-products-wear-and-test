import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { Box, ChevronRight, Cpu, Move3d, ScanFace } from 'lucide-react';
import { VirtualTryOn } from '../components/tryon/VirtualTryOn';
import { JewellerySelector } from '../components/catalog/JewellerySelector';
import { ProductDetails } from '../components/catalog/ProductDetails';
import { JewelleryShowroom } from '../components/catalog/JewelleryShowroom';
import { Seo } from '../components/site/Seo';
import { findProduct, PRODUCTS, type CategoryId, type Product } from '../config/catalog';

const STEPS = [
  { icon: ScanFace, title: 'Allow camera or upload', body: 'Processed on your device' },
  { icon: Move3d, title: 'Pick any piece', body: 'Placed and tracked in real time' },
  { icon: Cpu, title: 'Capture your look', body: 'Download a high-res photo' },
];

type Mode = 'tryon' | 'showroom';

export default function JewelleryStudio() {
  const [product, setProduct] = useState<Product>(() => findProduct('devika-temple-jhumkas') ?? PRODUCTS[0]);
  const [category, setCategory] = useState<CategoryId>(product.category);
  const [mode, setMode] = useState<Mode>('tryon');

  const select = useCallback((p: Product) => {
    setProduct(p);
    setCategory(p.category);
  }, []);

  const scrollToTryOn = useCallback(() => {
    setMode('tryon');
    document.getElementById('try-on')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <>
      <Seo
        title="Jewellery Studio · Virtual Try-On"
        description="Try on earrings, necklaces, nose rings, maang tikka and bridal sets in real time with live 3D face tracking, studio backgrounds and a 3D showroom."
        path="/jewellery"
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
            <span className="text-ink">Jewellery Studio</span>
          </nav>
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
          >
            <div className="max-w-2xl">
              <p className="eyebrow">Demo storefront · Suvarna Fine Jewellery</p>
              <h1 className="display mt-3 text-[44px] leading-[0.98] sm:text-6xl lg:text-[72px]">
                Virtual Jewellery <span className="whitespace-nowrap text-gold italic">Try&#8209;On</span>
              </h1>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-cocoa sm:text-base">
                Every piece is a 3D model placed on the shopper’s face or neckline and tracked as they move. Shoppers can also
                replace the room behind them with a studio backdrop and inspect each piece in the showroom.
              </p>
            </div>
            <ol className="grid grid-cols-3 gap-2 sm:gap-3 lg:w-[460px]">
              {STEPS.map((s, i) => (
                <li key={s.title} className="rounded-lg border border-line bg-white p-3 sm:p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg text-champagne">0{i + 1}</span>
                    <s.icon className="h-4 w-4 text-gold" />
                  </div>
                  <p className="mt-2 text-[12px] leading-snug font-semibold text-ink sm:text-[13px]">{s.title}</p>
                  <p className="mt-0.5 hidden text-[11px] text-muted sm:block">{s.body}</p>
                </li>
              ))}
            </ol>
          </motion.div>

          <div className="mt-8 flex items-center gap-1 rounded-md border border-line bg-white p-1 sm:inline-flex" role="tablist" aria-label="Studio mode">
            {(
              [
                ['tryon', 'Virtual Try-On', ScanFace],
                ['showroom', '3D Showroom', Box],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                role="tab"
                aria-selected={mode === id}
                onClick={() => setMode(id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-[7px] px-5 py-2.5 text-[13px] font-semibold transition-colors sm:flex-none ${
                  mode === id ? 'bg-ink text-ivory' : 'text-cocoa hover:text-ink'
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section id="try-on" className="container-lux mt-5 scroll-mt-24">
        {mode === 'tryon' ? (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">
            <div className="min-w-0">
              <VirtualTryOn product={product} category={category} onProduct={select} onCategory={setCategory} />
            </div>
            <aside className="panel hidden h-[calc(min(70vh,640px)+78px)] overflow-hidden lg:block">
              <JewellerySelector category={category} onCategory={setCategory} selectedId={product.id} onSelect={select} layout="panel" />
            </aside>
            <div className="min-w-0 lg:hidden">
              <JewellerySelector category={category} onCategory={setCategory} selectedId={product.id} onSelect={select} layout="rail" />
            </div>
          </div>
        ) : (
          <JewelleryShowroom product={product} category={category} onProduct={select} onCategory={setCategory} />
        )}
      </section>

      {mode === 'tryon' && <ProductDetails product={product} onTryOn={scrollToTryOn} />}
      <div className="h-20" />
    </>
  );
}
