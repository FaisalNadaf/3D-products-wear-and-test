import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { ArrowRight, Heart, Maximize2, Minimize2 } from 'lucide-react';
import { formatPrice, productsIn, type CategoryId, type Product } from '../../config/catalog';
import type { ModelId } from '../../config/models';
import { useShop } from '../../state/shop';
import { useFullscreen } from '../../hooks/useFullscreen';
import { Product3DViewer, BACKDROPS, type Backdrop } from '../viewer/Product3DViewer';
import { LIGHTING_PRESETS, type LightingPreset } from '../three/StudioEnvironment';
import { CategoryTabs } from './JewellerySelector';
import { JewelleryCard } from './JewelleryCard';

interface Props {
  product: Product;
  category: CategoryId;
  onProduct: (p: Product) => void;
  onCategory: (c: CategoryId) => void;
}

/** Dedicated 3D presentation mode: inspect any piece under different lighting. */
export function JewelleryShowroom({ product, category, onProduct, onCategory }: Props) {
  const [lighting, setLighting] = useState<LightingPreset>('studio');
  const [backdrop, setBackdrop] = useState<Backdrop>('red');
  const [piece, setPiece] = useState<number | 'all'>('all');
  const { toggleWish, wishlist } = useShop();
  const stage = useRef<HTMLDivElement>(null);
  const fs = useFullscreen(stage);
  useEffect(() => setPiece('all'), [product.id]);
  const pieces: ModelId[] = piece === 'all' ? product.pieces : [product.pieces[piece]];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
      <div ref={stage} className={`relative ${fs.isFullscreen ? (fs.pseudo ? 'fixed inset-0 z-[55] bg-ivory' : 'h-full w-full bg-ivory') : ''}`}>
        <div className={fs.isFullscreen ? 'h-[100dvh]' : 'aspect-[4/4.4] sm:aspect-[4/3] lg:aspect-auto lg:h-[min(72vh,680px)]'}>
          <Product3DViewer pieces={pieces} label={product.name} lighting={lighting} backdrop={backdrop} />
        </div>
        <button
          onClick={fs.toggle}
          className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-md border border-line bg-white/90 shadow-sm backdrop-blur hover:border-ink"
          aria-label={fs.isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {fs.isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
        {product.pieces.length > 1 && (
          <div className="scrollbar-none absolute top-4 left-4 flex max-w-[calc(100%-80px)] gap-1.5 overflow-x-auto">
            {(['all', ...product.pieces.map((_, i) => i)] as const).map((v) => (
              <button key={String(v)} onClick={() => setPiece(v)} className={piece === v ? 'chip-on' : 'chip'}>
                {v === 'all' ? 'Full set' : `Piece ${v + 1}`}
              </button>
            ))}
          </div>
        )}
      </div>

      <aside className="panel flex flex-col p-5 lg:h-[min(72vh,680px)]">
        <motion.div key={product.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">{product.type}</p>
          <h3 className="display mt-1 text-3xl leading-tight">{product.name}</h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg font-bold text-gold-deep">{formatPrice(product.price)}</span>
            {product.compareAt && <span className="text-sm text-muted line-through">{formatPrice(product.compareAt)}</span>}
          </div>
        </motion.div>

        <div className="mt-5">
          <p className="label">Lighting</p>
          <div className="grid grid-cols-2 gap-2">
            {LIGHTING_PRESETS.map((l) => (
              <button
                key={l.id}
                onClick={() => setLighting(l.id)}
                aria-pressed={lighting === l.id}
                className={`rounded-md border p-2.5 text-left transition-colors ${lighting === l.id ? 'border-ink bg-ink text-ivory' : 'border-line hover:border-champagne'}`}
              >
                <span className="block text-[13px] font-semibold">{l.label}</span>
                <span className={`block text-[11px] ${lighting === l.id ? 'text-ivory/70' : 'text-muted'}`}>{l.note}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p className="label">Backdrop</p>
          <div className="flex gap-2">
            {BACKDROPS.map((b) => (
              <button
                key={b.id}
                onClick={() => setBackdrop(b.id)}
                title={b.label}
                aria-label={`${b.label} backdrop`}
                aria-pressed={backdrop === b.id}
                className={`h-9 w-9 rounded-full border-2 transition-transform hover:scale-105 ${backdrop === b.id ? 'border-ink' : 'border-white shadow-[0_0_0_1px_var(--color-line)]'}`}
                style={{ background: b.css }}
              />
            ))}
          </div>
        </div>

        <div className="mt-5 min-h-0 flex-1">
          <p className="label">Switch product</p>
          <CategoryTabs value={category} onChange={onCategory} />
          <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto pb-1">
            {productsIn(category).map((p) => (
              <JewelleryCard key={p.id} product={p} selected={p.id === product.id} onTryOn={onProduct} variant="compact" />
            ))}
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <Link className="btn-primary flex-1" to={`/contact?about=${encodeURIComponent(`${product.name} (${product.metal})`)}`}>
            Request a quote <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            className="btn-ghost px-3.5"
            onClick={() => toggleWish(product.id, product.name)}
            aria-label={wishlist.has(product.id) ? 'Remove from wishlist' : 'Save to wishlist'}
            aria-pressed={wishlist.has(product.id)}
          >
            <Heart className={`h-4 w-4 ${wishlist.has(product.id) ? 'fill-rose text-rose' : ''}`} />
          </button>
        </div>
      </aside>
    </div>
  );
}
