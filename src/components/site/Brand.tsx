import { Link } from 'react-router';

const B = import.meta.env.BASE_URL;

/** Cubiccode wordmark (supplied artwork, cropped & optimised; aspect ratio preserved). */
export function Wordmark({ className = 'h-[22px]', to = '/' }: { className?: string; to?: string | null }) {
  const img = (
    <picture>
      <source
        type="image/webp"
        srcSet={`${B}brand/cubiccode-wordmark-40.webp 1x, ${B}brand/cubiccode-wordmark-80.webp 2x, ${B}brand/cubiccode-wordmark-120.webp 3x`}
      />
      <img
        src={`${B}brand/cubiccode-wordmark-80.png`}
        alt="Cubiccode"
        width={379}
        height={40}
        className={`${className} w-auto`}
        decoding="async"
      />
    </picture>
  );
  if (to === null) return img;
  return (
    <Link to={to} className="flex items-center gap-2.5" aria-label="Cubiccode home">
      <img src={`${B}brand/cube-mark.webp`} alt="" width={28} height={30} className="h-7 w-auto" aria-hidden />
      {img}
    </Link>
  );
}
