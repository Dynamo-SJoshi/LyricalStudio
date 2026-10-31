"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useReducedMotionConfig } from "motion/react";
import { lyricShadow } from "./shared";
import { animateTo, poseTransform, resolveTiming, REST, type Pose, type Timing } from "./waapi";

/**
 * Smooth, cinematic word motion on the compositor thread.
 *
 * - Movement: Web Animations (transform + opacity only), so a busy main thread can't
 *   make words stutter while they slide into place.
 * - Motion blur: two faint copies follow the same path a few milliseconds behind,
 *   visible only while the word is moving.
 * - Morphing: words can enter stretched/skewed (scaleX, scaleY, skewX) and settle into
 *   their true shape, a squash-and-stretch morph.
 */

export type { Pose };

/** Critically damped: glides to rest with no bounce. */
export const glide: Timing = { type: "spring", stiffness: 110, damping: 21, mass: 1 };

type KineticProps = {
  shown: boolean;
  /** pose while hidden (and where it enters from) */
  from: Pose;
  /** pose while shown (defaults to rest) */
  to?: Pose;
  transition?: Timing;
  className?: string;
  style?: React.CSSProperties;
  /** include in FitBox measurement (default true) */
  measure?: boolean;
  children: React.ReactNode;
};

const GHOSTS = [
  { delay: 22, peak: 0.3 },
  { delay: 46, peak: 0.16 },
];

/** A word that glides between a hidden and a shown pose, with trailing motion blur. */
export function KineticWord({ shown, from, to, transition, className, style, measure = true, children }: KineticProps) {
  const reduce = useReducedMotionConfig() ?? false;
  const mainRef = useRef<HTMLSpanElement>(null);
  const ghostA = useRef<HTMLSpanElement>(null);
  const ghostB = useRef<HTMLSpanElement>(null);
  const hidden = { ...REST, ...from };
  const visible = { ...REST, ...to };
  const mounted = useRef(false);

  // start in the hidden pose (set imperatively so React re-renders never fight the animation)
  useLayoutEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    el.style.transform = poseTransform(hidden);
    el.style.opacity = String(hidden.opacity);
    for (const g of [ghostA.current, ghostB.current]) if (g) g.style.opacity = "0";
    // mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const first = !mounted.current;
    mounted.current = true;
    // already sitting in the hidden pose: nothing to do (most words of a line start here)
    if (first && !shown) return;
    const target = shown ? visible : hidden;
    const transform = poseTransform(target);
    const timing = reduce ? { easing: "linear", duration: 0, delay: 0 } : resolveTiming(transition ?? glide);
    if (reduce) {
      animateTo(el, { transform, opacity: target.opacity }, timing);
      return;
    }
    const start = getComputedStyle(el).transform;
    animateTo(el, { transform, opacity: target.opacity }, timing);
    // the trail: same path, slightly later, only visible mid-flight
    [ghostA.current, ghostB.current].forEach((ghost, i) => {
      if (!ghost) return;
      // start the trail from where the word is right now
      ghost.getAnimations().forEach((a) => a.cancel());
      ghost.style.transform = start === "none" ? transform : start;
      animateTo(ghost, { transform, opacity: 0 }, { ...timing, delay: timing.delay + GHOSTS[i].delay }, [{ offset: 0.12, value: GHOSTS[i].peak }]);
    });
    // poses are derived from props each render; re-run only when visibility flips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, reduce]);

  const positioned = className?.includes("absolute") ? {} : { position: "relative" as const };

  return (
    <span
      data-fit={measure ? "" : undefined}
      className={className}
      style={{ ...positioned, textShadow: lyricShadow(style?.color as string | undefined), ...style }}
    >
      <span ref={ghostB} aria-hidden className="pointer-events-none absolute inset-0" style={{ textShadow: "none" }}>
        {children}
      </span>
      <span ref={ghostA} aria-hidden className="pointer-events-none absolute inset-0" style={{ textShadow: "none" }}>
        {children}
      </span>
      <span ref={mainRef} className="relative inline-block">
        {children}
      </span>
    </span>
  );
}

/** Minimal compositor-animated span (no trail, not measured), e.g. single letters. */
export function KineticSpan({
  shown,
  from,
  transition,
  className,
  children,
}: {
  shown: boolean;
  from: Pose;
  transition?: Timing;
  className?: string;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotionConfig() ?? false;
  const ref = useRef<HTMLSpanElement>(null);
  const mounted = useRef(false);
  const hidden = { ...REST, ...from };
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = poseTransform(hidden);
    el.style.opacity = String(hidden.opacity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const first = !mounted.current;
    mounted.current = true;
    if (first && !shown) return;
    const target = shown ? REST : hidden;
    const timing = reduce ? { easing: "linear", duration: 0, delay: 0 } : resolveTiming(transition ?? glide);
    animateTo(el, { transform: poseTransform(target), opacity: target.opacity }, timing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, reduce]);
  return (
    <span ref={ref} className={`inline-block ${className ?? ""}`}>
      {children}
    </span>
  );
}
