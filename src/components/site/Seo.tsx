import { SITE } from '../../config/site';

/** Per-page metadata (React 19 hoists these tags into <head>). */
export function Seo({ title, description, path = '' }: { title: string; description: string; path?: string }) {
  const full = title === SITE.name ? `${SITE.name} — ${SITE.tagline}` : `${title} · ${SITE.name}`;
  return (
    <>
      <title>{full}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={full} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={`${SITE.url}${path}`} />
      <meta property="og:image" content={`${SITE.url}/brand/cube-512.png`} />
      <meta name="twitter:card" content="summary_large_image" />
      <link rel="canonical" href={`${SITE.url}${path}`} />
    </>
  );
}
