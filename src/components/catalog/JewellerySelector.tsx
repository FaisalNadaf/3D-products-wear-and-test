import { useEffect, useRef } from 'react';
import { CATEGORIES, productsIn, type CategoryId, type Product } from '../../config/catalog';
import { JewelleryCard } from './JewelleryCard';

interface TabsProps {
  value: CategoryId;
  onChange: (c: CategoryId) => void;
  tone?: 'light' | 'dark';
}

export function CategoryTabs({ value, onChange, tone = 'light' }: TabsProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // scroll only the tab strip (never the page) to keep the active tab in view
    const strip = ref.current;
    const el = strip?.querySelector<HTMLElement>(`[data-cat="${value}"]`);
    if (strip && el) strip.scrollTo({ left: el.offsetLeft - strip.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' });
  }, [value]);
  const dark = tone === 'dark';
  return (
    <div ref={ref} role="tablist" aria-label="Jewellery categories" className="scrollbar-none relative -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {CATEGORIES.map((c) => {
        const active = c.id === value;
        return (
          <button
            key={c.id}
            data-cat={c.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(c.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-[12.5px] font-semibold whitespace-nowrap transition-all duration-300 ${
              active
                ? dark
                  ? 'bg-white text-ink'
                  : 'bg-ink text-ivory shadow-soft'
                : dark
                  ? 'bg-white/10 text-white/85 hover:bg-white/20'
                  : 'border border-line bg-white text-cocoa hover:border-champagne hover:text-ink'
            }`}
          >
            {c.label}
            <span className={`ml-1.5 text-[10.5px] ${active ? (dark ? 'text-gold' : 'text-champagne') : 'opacity-50'}`}>
              {productsIn(c.id).length}
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface SelectorProps {
  category: CategoryId;
  onCategory: (c: CategoryId) => void;
  selectedId: string | null;
  onSelect: (p: Product) => void;
  layout: 'panel' | 'rail';
}

/** Product picker: a scrollable grid beside the stage on desktop, a swipe rail below it on mobile. */
export function JewellerySelector({ category, onCategory, selectedId, onSelect, layout }: SelectorProps) {
  const items = productsIn(category);
  const hint = CATEGORIES.find((c) => c.id === category)?.hint;

  if (layout === 'rail') {
    return (
      <div>
        <CategoryTabs value={category} onChange={onCategory} />
        <div className="scrollbar-none -mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
          {items.map((p) => (
            <JewelleryCard key={p.id} product={p} selected={p.id === selectedId} onTryOn={onSelect} variant="rail" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-5 pt-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-semibold text-ink">Choose a piece</h2>
          <span className="text-xs text-muted">{items.length} designs</span>
        </div>
        <p className="mt-0.5 text-xs text-muted">{hint}</p>
        <div className="mt-4">
          <CategoryTabs value={category} onChange={onCategory} />
        </div>
      </div>
      <div className="scrollbar-thin mt-3 min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        <div className="grid grid-cols-2 gap-3">
          {items.map((p) => (
            <JewelleryCard key={p.id} product={p} selected={p.id === selectedId} onTryOn={onSelect} />
          ))}
        </div>
      </div>
    </div>
  );
}
