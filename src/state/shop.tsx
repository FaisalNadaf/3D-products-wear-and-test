import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface Toast {
  id: number;
  message: string;
}

interface ShopState {
  bag: string[];
  wishlist: Set<string>;
  toasts: Toast[];
  addToBag: (id: string, name: string) => void;
  toggleWish: (id: string, name: string) => void;
  notify: (message: string) => void;
  dismiss: (id: number) => void;
}

const ShopContext = createContext<ShopState | null>(null);

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode) — state still works in memory */
  }
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const [bag, setBag] = useState<string[]>(() => load('suvarna.bag', []));
  const [wishlist, setWishlist] = useState<Set<string>>(() => new Set(load<string[]>('suvarna.wish', [])));
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const notify = useCallback(
    (message: string) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t.slice(-2), { id, message }]);
      window.setTimeout(() => dismiss(id), 3200);
    },
    [dismiss],
  );
  const addToBag = useCallback(
    (id: string, name: string) => {
      setBag((b) => {
        const next = [...b, id];
        save('suvarna.bag', next);
        return next;
      });
      notify(`${name} added to your bag`);
    },
    [notify],
  );
  const toggleWish = useCallback(
    (id: string, name: string) => {
      const had = wishlist.has(id);
      const next = new Set(wishlist);
      if (had) next.delete(id);
      else next.add(id);
      save('suvarna.wish', [...next]);
      setWishlist(next);
      notify(had ? `${name} removed from wishlist` : `${name} saved to wishlist`);
    },
    [notify, wishlist],
  );

  const value = useMemo(
    () => ({ bag, wishlist, toasts, addToBag, toggleWish, notify, dismiss }),
    [bag, wishlist, toasts, addToBag, toggleWish, notify, dismiss],
  );
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop must be used inside ShopProvider');
  return ctx;
}
