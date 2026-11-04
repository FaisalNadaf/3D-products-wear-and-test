import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

/** Fades/slides children in once when scrolled into view. */
export function Reveal({
  children,
  delay = 0,
  y = 22,
  className,
  as = 'div',
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'article';
}) {
  const reduce = useReducedMotion();
  const M = motion[as];
  return (
    <M
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.85, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </M>
  );
}

/** Mounts heavy children (WebGL canvases) only while near the viewport. */
export function InView({
  children,
  fallback = null,
  className,
  rootMargin = '200px',
  keepMounted = false,
}: {
  children: ReactNode;
  fallback?: ReactNode;
  className?: string;
  rootMargin?: string;
  keepMounted?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setVisible((v) => (keepMounted && v ? true : e.isIntersecting)),
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin, keepMounted]);
  return (
    <div ref={ref} className={className}>
      {visible ? children : fallback}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  body,
  align = 'left',
  className = '',
}: {
  eyebrow?: string;
  title: ReactNode;
  body?: ReactNode;
  align?: 'left' | 'center';
  className?: string;
}) {
  return (
    <Reveal className={`${align === 'center' ? 'mx-auto text-center' : ''} max-w-3xl ${className}`}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 className="display mt-3 text-[38px] leading-[1.02] sm:text-5xl lg:text-[56px]">{title}</h2>
      {body && <p className={`mt-4 text-[15px] leading-relaxed text-cocoa sm:text-base ${align === 'center' ? 'mx-auto' : ''} max-w-2xl`}>{body}</p>}
    </Reveal>
  );
}
