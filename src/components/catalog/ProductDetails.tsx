import { lazy, Suspense, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { ArrowRight, BadgeCheck, Heart, RefreshCcw, ShieldCheck, Truck } from 'lucide-react';
import { CATEGORIES, formatPrice, type Product } from '../../config/catalog';
import type { ModelId } from '../../config/models';
import { useShop } from '../../state/shop';
const Product3DViewer = lazy(() => import('../viewer/Product3DViewer').then((m) => ({ default: m.Product3DViewer })));

const PIECE_LABEL: Partial<Record<ModelId, string>> = {
  'choker-kundan': 'Choker',
  'chandbali-kundan': 'Chandbalis',
  'tikka-kundan': 'Maang tikka',
  'nath-bridal': 'Nath',
  'necklace-temple-gold': 'Temple haar',
  'jhumka-temple': 'Jhumkas',
  'necklace-diamond-riviera': 'Rivière',
  'stud-solitaire': 'Studs',
};

export function ProductDetails({ product, onTryOn }: { product: Product; onTryOn: () => void }) {
  const { toggleWish, wishlist } = useShop();
  const isSet = product.pieces.length > 1;
  const [view, setView] = useState<'all' | number>('all');
  useEffect(() => setView('all'), [product.id]);
  const pieces = view === 'all' ? product.pieces : [product.pieces[view]];
  const wished = wishlist.has(product.id);
  const category = CATEGORIES.find((c) => c.id === product.category)?.label;

  return (
    <section id="details" className="mx-auto mt-16 max-w-[1400px] scroll-mt-24 px-4 sm:px-6 lg:mt-24 lg:px-10">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Inspect in 3D</p>
          <h2 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">Every detail, up close</h2>
        </div>
        <p className="max-w-md text-sm text-muted">
          Rotate the piece, zoom in on the setting, and see how the metal and stones catch the light.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr] lg:gap-10">
        <div className="relative">
          <div className="aspect-[4/3.4] w-full sm:aspect-[4/3]">
            <Suspense fallback={<div className="shimmer h-full w-full rounded-xl" />}>
              <Product3DViewer pieces={pieces} label={product.name} backdrop="red" />
            </Suspense>
          </div>
          {isSet && (
            <div className="scrollbar-none absolute top-4 right-4 left-4 flex justify-end gap-1.5 overflow-x-auto pl-48">
              {(['all', ...product.pieces.map((_, i) => i)] as const).map((v) => (
                <button
                  key={String(v)}
                  onClick={() => setView(v)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-semibold shadow-sm transition-colors ${
                    view === v ? 'bg-ink text-ivory' : 'bg-white/90 text-cocoa hover:text-ink'
                  }`}
                >
                  {v === 'all' ? 'Full set' : (PIECE_LABEL[product.pieces[v]] ?? `Piece ${v + 1}`)}
                </button>
              ))}
            </div>
          )}
        </div>

        <motion.div key={product.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-muted uppercase">
            {category} · {product.type}
          </p>
          <h3 className="mt-2 font-display text-[40px] leading-[1.02] font-semibold sm:text-5xl">{product.name}</h3>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-2xl font-bold text-gold-deep">{formatPrice(product.price)}</span>
            {product.compareAt && <span className="text-base text-muted line-through">{formatPrice(product.compareAt)}</span>}
            <span className="text-xs text-muted">incl. taxes</span>
          </div>
          <p className="mt-5 leading-relaxed text-cocoa">{product.description}</p>

          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line text-sm">
            {[
              ['Metal', product.metal],
              ['Stones', product.stones ?? '—'],
              ['Weight', product.weight ?? 'Varies by size'],
              ['Certification', 'BIS Hallmark · IGI'],
            ].map(([k, v]) => (
              <div key={k} className="bg-white p-4">
                <dt className="text-[10.5px] font-semibold tracking-[0.14em] text-muted uppercase">{k}</dt>
                <dd className="mt-1 font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>

          <ul className="mt-5 flex flex-wrap gap-2">
            {product.highlights.map((h) => (
              <li key={h} className="rounded-full bg-pearl px-3 py-1.5 text-xs font-medium text-cocoa">
                {h}
              </li>
            ))}
          </ul>

          <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
            <Link className="btn-primary flex-1 py-3.5" to={`/contact?about=${encodeURIComponent(`${product.name} (${product.metal})`)}`}>
              Request a quote <ArrowRight className="h-4 w-4" />
            </Link>
            <button className="btn-ghost py-3.5" onClick={onTryOn}>
              Try it on
            </button>
            <button
              className="btn-ghost px-4 py-3.5"
              onClick={() => toggleWish(product.id, product.name)}
              aria-label={wished ? 'Remove from wishlist' : 'Save to wishlist'}
              aria-pressed={wished}
            >
              <Heart className={`h-4 w-4 ${wished ? 'fill-rose text-rose' : ''}`} />
            </button>
          </div>

          <ul className="mt-7 grid grid-cols-3 gap-3 border-t border-line pt-6 text-center text-[11.5px] text-cocoa">
            <li className="flex flex-col items-center gap-1.5">
              <Truck className="h-4 w-4 text-gold" /> Free insured delivery
            </li>
            <li className="flex flex-col items-center gap-1.5">
              <RefreshCcw className="h-4 w-4 text-gold" /> Lifetime exchange
            </li>
            <li className="flex flex-col items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-gold" /> Certified purity
            </li>
          </ul>
          <p className="mt-5 flex items-center gap-1.5 text-xs text-muted">
            <BadgeCheck className="h-3.5 w-3.5 text-gold" /> Every piece shown in 3D is the exact design you receive.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
