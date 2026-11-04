import { AnimatePresence, motion } from 'motion/react';
import { Check } from 'lucide-react';
import { useShop } from '../../state/shop';

export function Toasts() {
  const { toasts, dismiss } = useShop();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[70] flex flex-col items-center gap-2 px-4" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            onClick={() => dismiss(t.id)}
            className="pointer-events-auto flex items-center gap-2.5 rounded-full bg-ink px-5 py-3 text-sm text-ivory shadow-lift"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-champagne/90">
              <Check className="h-3 w-3 text-ink" strokeWidth={3} />
            </span>
            {t.message}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
