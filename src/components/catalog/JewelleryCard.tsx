import { memo, useState } from 'react';
import { motion } from 'motion/react';
import { Gem, Heart, ScanFace } from 'lucide-react';
import { formatPrice, thumbnailUrl, type Product } from '../../config/catalog';
import { useShop } from '../../state/shop';

interface Props {
  product: Product;
  selected: boolean;
  onTryOn: (p: Product) => void;
  variant?: 'grid' | 'rail' | 'compact';
}

export const JewelleryCard = memo(function JewelleryCard({ product, selected, onTryOn, variant = 'grid' }: Props) {
  const { wishlist, toggleWish } = useShop();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const wished = wishlist.has(product.id);

  if (variant === 'compact') {
    return (
      <button
        onClick={() => onTryOn(product)}
        aria-pressed={selected}
        aria-label={`Try on ${product.name}`}
        className={`group relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl border transition-all duration-300 ${
          selected ? 'border-champagne bg-white/95 ring-2 ring-champagne/70' : 'border-white/25 bg-white/80 hover:bg-white'
        }`}
      >
        <img src={thumbnailUrl(product)} alt="" className="h-full w-full object-contain p-1.5" draggable={false} />
      </button>
    );
  }

  const rail = variant === 'rail';
  return (
    <motion.article
      layout="position"
      className={`group relative flex flex-col overflow-hidden rounded-[22px] border bg-white transition-[border-color,box-shadow] duration-300 ${
        selected ? 'border-champagne shadow-lift ring-1 ring-champagne/60' : 'border-line/80 shadow-soft hover:border-champagne-soft hover:shadow-lift'
      } ${rail ? 'w-[158px] shrink-0 snap-start sm:w-[176px]' : ''}`}
    >
      <button
        className="relative block aspect-square w-full overflow-hidden bg-[radial-gradient(circle_at_50%_40%,#ffffff_0%,#f7f1e7_62%,#efe5d5_100%)]"
        onClick={() => onTryOn(product)}
        aria-label={`Try on ${product.name}`}
      >
        {!loaded && !failed && <div className="shimmer absolute inset-0" />}
        {failed ? (
          <Gem className="absolute inset-0 m-auto h-10 w-10 text-champagne" strokeWidth={1.2} />
        ) : (
          <img
            src={thumbnailUrl(product)}
            alt={product.name}
            loading="lazy"
            decoding="async"
            draggable={false}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`h-full w-full object-contain p-3 transition-all duration-700 ease-[var(--ease-lux)] group-hover:scale-[1.06] ${
              loaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}
        {product.badge && (
          <span className="absolute top-2.5 left-2.5 rounded-full bg-white/90 px-2.5 py-1 text-[9.5px] font-bold tracking-[0.14em] text-gold-deep uppercase shadow-sm backdrop-blur">
            {product.badge}
          </span>
        )}
        {selected && (
          <motion.span
            layoutId={rail ? 'wearing-rail' : 'wearing-grid'}
            className="absolute bottom-2.5 left-2.5 flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[10px] font-semibold tracking-wide text-ivory"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-champagne" /> Wearing
          </motion.span>
        )}
      </button>
      <button
        onClick={() => toggleWish(product.id, product.name)}
        className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-cocoa shadow-sm backdrop-blur transition-colors hover:text-rose"
        aria-label={wished ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
        aria-pressed={wished}
      >
        <Heart className={`h-4 w-4 ${wished ? 'fill-rose text-rose' : ''}`} />
      </button>
      <div className="flex flex-1 flex-col p-3 pt-2.5">
        <p className="truncate text-[10.5px] font-semibold tracking-[0.12em] text-muted uppercase">{product.type}</p>
        <h3 className="mt-0.5 line-clamp-2 font-display text-[17px] leading-tight font-semibold text-ink">{product.name}</h3>
        <div className="mt-1.5 flex items-baseline gap-1.5">
          <span className="text-[13.5px] font-bold text-gold-deep">{formatPrice(product.price)}</span>
          {product.compareAt && <span className="text-[11px] text-muted line-through">{formatPrice(product.compareAt)}</span>}
        </div>
        <button
          onClick={() => onTryOn(product)}
          className={`mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-full py-2 text-[12px] font-semibold transition-all duration-300 ${
            selected ? 'bg-ink text-ivory' : 'border border-line text-ink hover:border-ink hover:bg-ink hover:text-ivory'
          }`}
        >
          <ScanFace className="h-3.5 w-3.5" />
          {selected ? 'Trying on' : 'Try On'}
        </button>
      </div>
    </motion.article>
  );
});
