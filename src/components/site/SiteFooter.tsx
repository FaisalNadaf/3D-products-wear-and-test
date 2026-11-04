import { Link, useLocation } from 'react-router';
import { ArrowUpRight } from 'lucide-react';
import { EXPERIENCES } from '../../config/site';
import { Wordmark } from './Brand';

export function SiteFooter() {
  const { pathname } = useLocation();
  // Home and Contact already end with an inquiry section
  const showCta = pathname !== '/' && pathname !== '/contact';
  return (
    <footer className="border-t border-line bg-cream">
      <div className="container-lux py-16">
        <div hidden={!showCta} className="mb-12 border-b border-line pb-12">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="eyebrow">Have a product in mind?</p>
            <p className="display mt-3 text-4xl leading-[1.05] sm:text-5xl">Let’s build an experience your customers remember.</p>
          </div>
          <Link to="/contact" className="btn-primary self-start lg:self-auto">
            Start a project <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
        </div>
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[2fr_1fr]">
          <div>
            <Wordmark className="h-[18px]" />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-muted">
              We design and engineer interactive 3D product experiences: virtual try-on, configurators and visualization tools for
              e-commerce.
            </p>
          </div>
          <FooterCol title="Experiences" links={EXPERIENCES.map((e) => [e.title, e.path])} />
        </div>
      </div>
      <div className="border-t border-line">
        <div className="container-lux flex flex-col gap-2 py-5 text-xs text-muted sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} Cubiccode. All rights reserved.</span>
          <span>Demo storefronts on this site use placeholder products and prices.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: string[][] }) {
  return (
    <div>
      <h3 className="eyebrow">{title}</h3>
      <ul className="mt-4 space-y-2.5">
        {links.map(([l, to]) => (
          <li key={l}>
            <Link to={to} className="text-sm text-cocoa transition-colors hover:text-gold-deep">
              {l}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
