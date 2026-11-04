import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ScrollRestoration, useLocation, useOutlet, useNavigation } from 'react-router';
import { cloneElement, Suspense, useEffect } from 'react';
import { SiteNavbar } from './SiteNavbar';
import { SiteFooter } from './SiteFooter';
import { Toasts } from './Toasts';
import { ShopProvider } from '../../state/shop';

export function PageLoader() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4" role="status" aria-live="polite">
      <div className="relative h-12 w-12">
        <span className="absolute inset-0 animate-ping rounded-full bg-champagne/30" />
        <span className="absolute inset-2 rounded-full border-2 border-champagne border-t-transparent animate-spin" />
      </div>
      <p className="text-xs font-semibold tracking-[0.2em] text-muted uppercase">Loading experience</p>
    </div>
  );
}

/** Global shell: navigation, animated page transitions, footer, toasts. */
export function SiteLayout() {
  const location = useLocation();
  const outlet = useOutlet();
  const navigation = useNavigation();
  const reduce = useReducedMotion();
  // lazy pages render late, so scroll to #hash targets once they exist
  useEffect(() => {
    if (!location.hash) return;
    let tries = 0;
    const id = window.setInterval(() => {
      const el = document.getElementById(location.hash.slice(1));
      if (el || ++tries > 30) {
        window.clearInterval(id);
        el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [location.pathname, location.hash, reduce]);
  return (
    <ShopProvider>
      <div className="min-h-screen overflow-x-clip">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[80] focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-ivory">
          Skip to content
        </a>
        <SiteNavbar />
        {navigation.state === 'loading' && (
          <div className="fixed inset-x-0 top-0 z-[70] h-0.5 overflow-hidden">
            <div className="h-full w-1/3 animate-[shimmer_1s_linear_infinite] bg-champagne" />
          </div>
        )}
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            id="main"
            key={location.pathname}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <Suspense fallback={<PageLoader />}>{outlet && cloneElement(outlet, { key: location.pathname })}</Suspense>
          </motion.main>
        </AnimatePresence>
        <SiteFooter />
        <Toasts />
        <ScrollRestoration />
      </div>
    </ShopProvider>
  );
}
