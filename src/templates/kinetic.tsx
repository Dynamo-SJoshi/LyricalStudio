"use client";

import { useEffect } from "react";
import { glassVars } from "./shared";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotionConfig,
  useTransform,
  useVelocity,
  type MotionValue,
  type Transition,
} from "motion/react";

/**
 * Smooth, cinematic word motion.
 *
 * Motion blur is done with "ghost trails": two faint copies of the word that lag
 * behind it in proportion to its speed. They only move with transforms and opacity,
 * which the GPU composites for free, unlike blur filters that re-render text every frame.
 *
 * Morphing: words can enter stretched/skewed (scaleX, scaleY, skewX) and settle into
 * their true shape, a squash-and-stretch morph.
 */

/** Critically damped: glides to rest with no bounce. */
export const glide: Transition = { type: "spring", stiffness: 110, damping: 21, mass: 1 };

/** Mount once: the threshold filter used by the gooey Morph layout. */
export function GooeyDefs() {
  return (
    <svg aria-hidden width="0" height="0" style={{ position: "absolute" }}>
      <defs>
        <filter id="gooey-threshold" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 255 -140" />
        </filter>
      </defs>
    </svg>
  );
}

export type Pose = {
  /** em */
  x?: number;
  /** em */
  y?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  skewX?: number;
  opacity?: number;
  rotate?: number;
};

const REST: Required<Pose> = { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, skewX: 0, opacity: 1, rotate: 0 };
const KEYS = Object.keys(REST) as (keyof Pose)[];

type KineticProps = {
  shown: boolean;
  /** pose while hidden (and where it enters from) */
  from: Pose;
  /** pose while shown (defaults to rest) */
  to?: Pose;
  transition?: Transition;
  className?: string;
  style?: React.CSSProperties;
  /** include in FitBox measurement (Burst measures only the active word) */
  measure?: boolean;
  /** Liquid Glass glyphs (on by default) */
  glass?: boolean;
  children: React.ReactNode;
};

function useGhost(vx: MotionValue<number>, vy: MotionValue<number>, vs: MotionValue<number>, lag: number, strength: number, off: boolean) {
  const x = useTransform(vx, (v) => `${-v * lag}em`);
  const y = useTransform(vy, (v) => `${-v * lag}em`);
  const scale = useTransform(vs, (v) => 1 - v * lag * 0.8);
  const opacity = useTransform(() => {
    if (off) return 0;
    const speed = Math.hypot(vx.get(), vy.get()) + Math.abs(vs.get()) * 4;
    return Math.min(0.34, speed / 70) * strength;
  });
  return { x, y, scale, opacity };
}

/** A word that glides between a hidden and a shown pose, with ghost-trail motion blur. */
export function KineticWord({ shown, from, to, transition, className, style, measure = true, glass = true, children }: KineticProps) {
  const reduce = useReducedMotionConfig() ?? false;
  const hidden = { ...REST, ...from };
  const visible = { ...REST, ...to };

  const x = useMotionValue(hidden.x);
  const y = useMotionValue(hidden.y);
  const scale = useMotionValue(hidden.scale);
  const scaleX = useMotionValue(hidden.scaleX);
  const scaleY = useMotionValue(hidden.scaleY);
  const skewX = useMotionValue(hidden.skewX);
  const opacity = useMotionValue(hidden.opacity);
  const rotate = useMotionValue(hidden.rotate);
  const values: Record<keyof Pose, MotionValue<number>> = { x, y, scale, scaleX, scaleY, skewX, opacity, rotate };

  useEffect(() => {
    const target = shown ? visible : hidden;
    const t = reduce ? { duration: 0 } : (transition ?? glide);
    const controls = KEYS.map((k) => animate(values[k], target[k], t));
    return () => controls.forEach((c) => c.stop());
    // poses are derived from props each render; re-run only when visibility flips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, reduce]);

  const vx = useVelocity(x);
  const vy = useVelocity(y);
  const vs = useVelocity(scale);
  const g1 = useGhost(vx, vy, vs, 0.022, 1, reduce);
  const g2 = useGhost(vx, vy, vs, 0.045, 0.55, reduce);

  const tx = useTransform(x, (v) => `${v}em`);
  const ty = useTransform(y, (v) => `${v}em`);
  const positioned = className?.includes("absolute") ? {} : { position: "relative" as const };

  return (
    <motion.span
      data-fit={measure ? "" : undefined}
      className={className}
      style={{ ...positioned, ...(glass ? glassVars(style?.color as string | undefined) : {}), ...style, x: tx, y: ty, scale, scaleX, scaleY, skewX, rotate, opacity, willChange: "transform, opacity" }}
    >
      <motion.span aria-hidden className={`${glass ? "glass-glyph " : ""}pointer-events-none absolute inset-0`} style={g2}>
        {children}
      </motion.span>
      <motion.span aria-hidden className={`${glass ? "glass-glyph " : ""}pointer-events-none absolute inset-0`} style={g1}>
        {children}
      </motion.span>
      <span className={glass ? "glass-glyph relative" : "relative"}>{children}</span>
    </motion.span>
  );
}
