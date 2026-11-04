import { Link } from 'react-router';
import { Seo } from '../components/site/Seo';

export function NotFound() {
  return (
    <section className="container-lux flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
      <Seo title="Page not found" description="The page you were looking for does not exist." />
      <p className="eyebrow">404</p>
      <h1 className="display mt-3 text-5xl">This page has moved on</h1>
      <p className="mt-4 max-w-md text-cocoa">The link may be outdated. Explore our experiences or get in touch.</p>
      <div className="mt-8 flex gap-3">
        <Link to="/" className="btn-primary">Back to home</Link>
        <Link to="/contact" className="btn-ghost">Contact us</Link>
      </div>
    </section>
  );
}
