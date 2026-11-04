import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, ChevronDown, Menu, X } from 'lucide-react';
import { EXPERIENCES } from '../../config/site';
import { Wordmark } from './Brand';

const B = import.meta.env.BASE_URL;

/** Sticky global navigation with an Experiences mega-dropdown and a mobile drawer. */
export function SiteNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const location = useLocation();
  const closeTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    setMenu(false);
    setDrawer(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!menu && !drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(false);
        setDrawer(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu, drawer]);

  const inExperience = EXPERIENCES.some((e) => location.pathname.startsWith(e.path));
  const open = () => {
    window.clearTimeout(closeTimer.current);
    setMenu(true);
  };
  const close = () => {
    closeTimer.current = window.setTimeout(() => setMenu(false), 140);
  };
  const link = ({ isActive }: { isActive: boolean }) =>
    `relative py-2 text-[13.5px] font-medium tracking-wide transition-colors hover:text-ink ${isActive ? 'text-ink' : 'text-cocoa'}`;

  return (
    <header
      className={`sticky top-0 z-50 transition-[background-color,border-color,box-shadow] duration-500 ${
        scrolled || menu ? 'border-b border-line/80 bg-ivory/92 shadow-[0_8px_30px_-24px_rgba(22,26,44,0.35)] backdrop-blur-lg' : 'border-b border-transparent bg-ivory'
      }`}
    >
      <nav className="container-lux flex h-16 items-center justify-between lg:h-[76px]" aria-label="Main">
        <Wordmark className="h-[18px] sm:h-5" />

        <ul className="hidden items-center gap-9 lg:flex">
          <li>
            <NavLink to="/" end className={link}>
              Home
            </NavLink>
          </li>
          <li className="relative" onMouseEnter={open} onMouseLeave={close}>
            <button
              className={`flex items-center gap-1 py-2 text-[13.5px] font-medium tracking-wide transition-colors hover:text-ink ${inExperience ? 'text-ink' : 'text-cocoa'}`}
              aria-expanded={menu}
              aria-haspopup="true"
              onClick={() => setMenu((m) => !m)}
              onFocus={open}
            >
              Experiences <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${menu ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {menu && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute top-full left-1/2 w-[640px] -translate-x-1/2 pt-4"
                  onMouseEnter={open}
                  onMouseLeave={close}
                >
                  <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-white p-2 shadow-lift">
                    {EXPERIENCES.map((e) => (
                      <Link
                        key={e.id}
                        to={e.path}
                        className="group flex items-center gap-3.5 rounded-lg p-2.5 transition-colors hover:bg-cream"
                      >
                        <span className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-pearl">
                          <img src={`${B}${e.image.slice(1)}`} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        </span>
                        <span>
                          <span className="flex items-center gap-1 text-[14px] font-semibold text-ink">
                            {e.title}
                            <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                          </span>
                          <span className="mt-0.5 block text-[12px] leading-snug text-muted">{e.short}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        </ul>

        <div className="flex items-center gap-2">
          <Link to="/contact" className="btn-primary hidden min-h-10 px-4 text-[13px] sm:inline-flex">
            Start a project
          </Link>
          <button className="-mr-2 rounded-md p-2.5 text-ink lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {drawer && (
          <motion.div className="fixed inset-0 z-[60] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]" onClick={() => setDrawer(false)} />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="absolute inset-y-0 right-0 flex w-[88%] max-w-sm flex-col overflow-y-auto bg-ivory p-6 shadow-lift"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            >
              <div className="flex items-center justify-between">
                <Wordmark className="h-[17px]" />
                <button className="rounded-md p-2" onClick={() => setDrawer(false)} aria-label="Close menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <Link to="/" className="mt-8 border-b border-line py-3.5 font-display text-2xl">
                Home
              </Link>
              <p className="eyebrow mt-6">Experiences</p>
              <div className="mt-3 space-y-2">
                {EXPERIENCES.map((e) => (
                  <Link key={e.id} to={e.path} className="flex items-center gap-3 rounded-lg border border-line bg-white p-2.5">
                    <img src={`${B}${e.image.slice(1)}`} alt="" className="h-12 w-12 rounded-md object-cover" />
                    <span>
                      <span className="block text-[14px] font-semibold">{e.title}</span>
                      <span className="block text-[12px] text-muted">{e.short}</span>
                    </span>
                  </Link>
                ))}
              </div>
              <Link to="/contact" className="btn-primary mt-8">
                Start a project
              </Link>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
