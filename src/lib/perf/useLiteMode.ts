"use client";

import { useEffect, useState } from "react";

/**
 * Lite mode: lighter lyric effects, so motion stays smooth on any machine.
 *
 * - Devices with few cores or little memory start in lite mode.
 * - Otherwise frame timing is sampled (a timestamp per frame, nothing else): one window of
 *   frames, then a pause (a frame callback on every refresh is itself main-thread work,
 *   240 times a second on fast screens). The screen's own frame interval is learned (60,
 *   120, 240 Hz...), and if too many frames miss it in two windows in a row, lite mode
 *   turns on for the rest of the session. It never turns itself back off (no
 *   flip-flopping between looks).
 *
 * The animated background has its own adaptive resolution; this covers the lyrics.
 */

const KEY = "ls:lite";
const WINDOW = 180; // frames per measurement
const MISSED = 1.7; // a frame that takes this many intervals (or more) missed its slot
const MAX_MISSED_SHARE = 0.12; // a window is slow when more frames than this missed
const STRIKES = 2; // slow windows in a row before switching
const PAUSE_MS = 8000; // between windows

function startsLite() {
  if (typeof window === "undefined") return false;
  if (sessionStorage.getItem(KEY) === "1") return true;
  const nav = navigator as Navigator & { deviceMemory?: number };
  return (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
}

export function useLiteMode(active = true) {
  const [lite, setLite] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (startsLite()) setLite(true);
  }, []);

  useEffect(() => {
    if (!active || lite) return;
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last = 0;
    let deltas: number[] = [];
    let strikes = 0;
    const tick = (t: number) => {
      const dt = last ? t - last : 0;
      last = t;
      // skip hidden tabs and long pauses (they aren't the lyrics' fault)
      if (dt > 0 && dt < 250 && !document.hidden) {
        deltas.push(dt);
        if (deltas.length >= WINDOW) {
          // the screen's frame interval: the fast end of what we saw
          const sorted = [...deltas].sort((x, y) => x - y);
          const interval = sorted[Math.floor(sorted.length * 0.1)];
          const missed = deltas.filter((x) => x > interval * MISSED).length / deltas.length;
          strikes = missed > MAX_MISSED_SHARE ? strikes + 1 : 0;
          deltas = [];
          if (strikes >= STRIKES) {
            sessionStorage.setItem(KEY, "1");
            setLite(true);
            return;
          }
          // a slow window is re-checked right away; otherwise rest for a while
          if (!strikes) {
            last = 0;
            timer = setTimeout(() => (raf = requestAnimationFrame(tick)), PAUSE_MS);
            return;
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [active, lite]);

  return lite;
}
