"use client";

import { useEffect, useRef } from "react";
import { animate } from "motion/react";
import type { Palette } from "@/lib/theme/palette";

/**
 * Liquid Glass background:
 *   1. the light: blurred album art plus soft color fields from its palette, drifting
 *   2. a glow that pulses with every sung word (listens for "ls:word")
 *   3. the glass: a slab with bright edges, a gliding reflection and fine grain
 * Everything that moves animates only transform/opacity, so the GPU composites it.
 */
export function AmbientBackground({ palette, artwork }: { palette: Palette; artwork?: string }) {
  const pulseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let i = 0;
    const onWord = () => {
      const el = pulseRef.current;
      if (!el) return;
      el.style.setProperty("--tint", palette.accents[i++ % 3]);
      animate(el, { opacity: [0.5, 0], scale: [0.92, 1.08] }, { duration: 1.4, ease: [0.16, 1, 0.3, 1] });
    };
    window.addEventListener("ls:word", onWord);
    return () => window.removeEventListener("ls:word", onWord);
  }, [palette]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden" style={{ background: palette.base, transition: "background 1.2s ease" }}>
      {/* the light behind the glass */}
      {artwork && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={artwork}
          alt=""
          referrerPolicy="no-referrer"
          className="absolute inset-[-20%] h-[140%] w-[140%] object-cover opacity-40 blur-[90px] saturate-150"
        />
      )}
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`ambient-blob ambient-blob-${i}`}
          style={{ background: `radial-gradient(circle, ${palette.accents[i % 3]} 0%, transparent 65%)` }}
        />
      ))}
      <div
        ref={pulseRef}
        className="bloom absolute top-1/2 left-1/2 h-[120vmin] w-[120vmin] -translate-1/2 rounded-full opacity-0"
      />

      {/* keep text readable over bright art */}
      <div className="absolute inset-0 bg-black/35" />

      {/* the glass */}
      <div className="bg-glass-slab absolute inset-0" />
      <div className="bg-glass-sweep" />
      <div className="glass-grain absolute inset-0" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.45)_100%)]" />
    </div>
  );
}
