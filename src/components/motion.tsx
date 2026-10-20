"use client";

import React, { useEffect, useRef, useState } from 'react';

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Fades/slides its children in the first time they scroll into view. */
export function Reveal({
  children,
  delay = 0,
  as: Tag = 'div',
  className = '',
  style,
  ...rest
}: {
  children: React.ReactNode;
  delay?: number;
  as?: React.ElementType;
  className?: string;
  style?: React.CSSProperties;
} & React.HTMLAttributes<HTMLElement>) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced() || !('IntersectionObserver' in window)) {
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`reveal ${shown ? 'in' : ''} ${className}`} style={{ ...style, transitionDelay: `${delay}ms` }} {...rest}>
      {children}
    </Tag>
  );
}

/** Animates a number from 0 (or its previous value) to `value`. */
export function CountUp({ value, duration = 900, format = (n: number) => Math.round(n).toLocaleString('en-IN') }: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
}) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (reduced()) {
      from.current = value;
      const id = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(id);
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(a + (value - a) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{format(shown)}</>;
}

/**
 * Cursor spotlight: any element with the `spot` class gets --mx/--my set to
 * the pointer position, which the CSS turns into a soft light on its border
 * and surface. One listener for the whole page.
 */
export function useSpotlight() {
  useEffect(() => {
    if (reduced() || window.matchMedia('(hover: none)').matches) return;
    let last: HTMLElement | null = null;
    const onMove = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('.spot') as HTMLElement | null;
      if (last && last !== el) last.style.removeProperty('--spot-o');
      last = el;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
      el.style.setProperty('--spot-o', '1');
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);
}

/** Mount-time spotlight hook as a component, for server layouts. */
export function SpotlightLayer() {
  useSpotlight();
  return null;
}

/** Score ring for 0–100 values. */
export function ScoreRing({ value, size = 38, label }: { value: number; size?: number; label?: string }) {
  const r = (size - 5) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value || 0));
  const color = v >= 85 ? 'var(--accent)' : v >= 70 ? 'var(--amber)' : 'var(--text-3)';
  return (
    <span className="score-ring" style={{ width: size, height: size }} title={label ?? `Hold score ${v}/100 — an editorial estimate, not a prediction`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth="3" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="score-ring-arc"
        />
      </svg>
      <span className="score-ring-num tnum">{Math.round(v)}</span>
    </span>
  );
}
