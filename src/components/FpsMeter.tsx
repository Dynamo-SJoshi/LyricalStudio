"use client";

import { useEffect, useState } from "react";

/** Shift+F toggles a small frame-rate readout (frames per second and the slowest frame). */
export function FpsMeter() {
  const [visible, setVisible] = useState(false);
  const [stats, setStats] = useState({ fps: 0, worst: 0 });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F" && e.shiftKey && !(e.target instanceof HTMLInputElement)) setVisible((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!visible) return;
    let raf = 0;
    let frames = 0;
    let worst = 0;
    let last = performance.now();
    let windowStart = last;
    const tick = (t: number) => {
      frames++;
      worst = Math.max(worst, t - last);
      last = t;
      if (t - windowStart >= 1000) {
        setStats({ fps: Math.round((frames * 1000) / (t - windowStart)), worst: Math.round(worst) });
        frames = 0;
        worst = 0;
        windowStart = t;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  if (!visible) return null;
  return (
    <div className="glass fixed top-20 left-6 z-50 rounded-xl px-3 py-2 font-mono text-[12px] tabular-nums">
      {stats.fps} fps · slowest {stats.worst} ms
    </div>
  );
}
