"use client";

import { useEffect, useRef } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  useVelocity,
  type MotionValue,
  type Transition,
} from "motion/react";

/**
 * Motion blur, done cheaply: directional SVG blur filters at a few fixed strengths,
 * switched by how fast an element is moving. Elements at rest have no filter at all,
 * so the cost only exists during the brief moment something is in motion.
 */
const STRENGTHS = [1, 2, 4, 7, 11, 16];

/** Mount once: the shared directional blur filters referenced by url(#mbx-N) / url(#mby-N). */
export function MotionBlurDefs() {
  return (
    <svg aria-hidden width="0" height="0" style={{ position: "absolute" }}>
      <defs>
        {STRENGTHS.map((n) => (
          <g key={n}>
            <filter id={`mbx-${n}`} x="-60%" y="-10%" width="220%" height="120%" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation={`${n} 0`} />
            </filter>
            <filter id={`mby-${n}`} x="-10%" y="-60%" width="120%" height="220%" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation={`0 ${n}`} />
            </filter>
          </g>
        ))}
      </defs>
    </svg>
  );
}

function nearest(px: number) {
  return STRENGTHS.reduce((a, b) => (Math.abs(b - px) < Math.abs(a - px) ? b : a));
}

/** Blur for an element moving at `vx`/`vy` px per second (one frame's travel, halved). */
export function blurFor(vx: number, vy: number, zoom = 0): string {
  const bx = Math.abs(vx) / 60 / 2;
  const by = Math.abs(vy) / 60 / 2;
  if (zoom > 0.8) return `blur(${Math.min(8, Math.round(zoom))}px)`;
  if (bx < 0.9 && by < 0.9) return "none";
  return bx >= by ? `url(#mbx-${nearest(bx)})` : `url(#mby-${nearest(by)})`;
}

export type Pose = {
  /** em */
  x?: number;
  /** em */
  y?: number;
  scale?: number;
  opacity?: number;
  rotate?: number;
};

const REST: Required<Pose> = { x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 };

type KineticProps = {
  shown: boolean;
  /** pose while hidden (and where it enters from) */
  from: Pose;
  /** pose while shown (defaults to rest) */
  to?: Pose;
  transition?: Transition;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
};

/** A word that animates between a hidden and a shown pose, with velocity-based motion blur. */
export function KineticWord({ shown, from, to, transition, className, style, children }: KineticProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const fontPx = useRef(48);
  const reduce = useReducedMotion();
  const hidden = { ...REST, ...from };
  const visible = { ...REST, ...to };

  const x = useMotionValue(hidden.x);
  const y = useMotionValue(hidden.y);
  const scale = useMotionValue(hidden.scale);
  const opacity = useMotionValue(hidden.opacity);
  const rotate = useMotionValue(hidden.rotate);
  const vx = useVelocity(x);
  const vy = useVelocity(y);
  const vs = useVelocity(scale);

  useEffect(() => {
    if (ref.current) fontPx.current = parseFloat(getComputedStyle(ref.current).fontSize) || 48;
  }, []);

  useEffect(() => {
    const target = shown ? visible : hidden;
    const t = reduce ? { duration: 0 } : (transition ?? { type: "spring", stiffness: 300, damping: 30 });
    const pairs: [MotionValue<number>, number][] = [
      [x, target.x],
      [y, target.y],
      [scale, target.scale],
      [opacity, target.opacity],
      [rotate, target.rotate],
    ];
    const controls = pairs.map(([mv, v]) => animate(mv, v, t));
    return () => controls.forEach((c) => c.stop());
    // poses are derived from props each render; re-run only when visibility flips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, reduce]);

  const tx = useTransform(x, (v) => `${v}em`);
  const ty = useTransform(y, (v) => `${v}em`);
  const filter = useTransform(() => {
    if (reduce) return "none";
    const f = fontPx.current;
    // velocities are in em/s and scale/s; convert to on-screen px/s
    return blurFor(vx.get() * f, vy.get() * f, Math.abs(vs.get()) * f * 0.012);
  });

  return (
    <motion.span ref={ref} className={className} style={{ ...style, x: tx, y: ty, scale, opacity, rotate, filter }}>
      {children}
    </motion.span>
  );
}
