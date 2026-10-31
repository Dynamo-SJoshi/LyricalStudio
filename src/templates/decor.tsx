"use client";

import { motion } from "motion/react";
import type { LyricLine } from "@/lib/types";
import type { Palette } from "@/lib/theme/palette";
import { rng } from "./shared";

/**
 * Decorations: the shapes that make a line feel alive, Cotodama-style.
 * "Under" decorations sit behind the text. "Over" decorations sit on top and use
 * difference blending, so text inside the shape flips color (white text turns dark
 * on a light shape), just like the Lyric Speaker.
 */
export type UnderDecor = "network" | "outlines" | "rings" | "particles" | "stripes" | "blob";
export type OverDecor = "bands" | "diamond" | "panel";

export type DecorProps = {
  line: LyricLine;
  revealed: number;
  palette: Palette;
  seed: number;
};

const PAPER = "#f5f5f7";
const invert = { mixBlendMode: "difference" as const };
const lineDuration = (l: LyricLine) => Math.max(1.5, l.end - l.start);

/* ---------------------------------- over ---------------------------------- */

/** One or two light bars sweeping across, flipping the text they cross. */
function Bands({ seed, line }: DecorProps) {
  const r = rng(seed + 11);
  const n = 1 + Math.floor(r() * 2);
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const top = 12 + r() * 58;
        const height = 13 + r() * 15;
        const fromLeft = r() < 0.5;
        return (
          <motion.div
            key={i}
            className="absolute left-0 w-full"
            style={{ top: `${top}cqh`, height: `${height}cqh`, background: PAPER, ...invert, transformOrigin: fromLeft ? "left" : "right" }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1, y: ["0cqh", `${(r() - 0.5) * 6}cqh`] }}
            transition={{
              scaleX: { type: "spring", stiffness: 110, damping: 20, delay: 0.08 + i * 0.22 },
              y: { duration: lineDuration(line), ease: "easeInOut" },
            }}
          />
        );
      })}
    </>
  );
}

/** A big rotating diamond that grows out of the center. */
function Diamond({ seed, line }: DecorProps) {
  const r = rng(seed + 23);
  const dir = r() < 0.5 ? -1 : 1;
  const size = 58 + r() * 22;
  return (
    <motion.div
      className="absolute top-1/2 left-1/2"
      style={{ width: `${size}cqh`, height: `${size}cqh`, marginLeft: `${-size / 2}cqh`, marginTop: `${-size / 2}cqh`, background: PAPER, ...invert }}
      initial={{ scale: 0, rotate: 45 - dir * 40 }}
      animate={{ scale: 1, rotate: 45 + dir * 12 }}
      transition={{
        scale: { type: "spring", stiffness: 120, damping: 16 },
        rotate: { duration: lineDuration(line), ease: [0.16, 1, 0.3, 1] },
      }}
    />
  );
}

/** A panel sliding in from one side, splitting the stage into light and dark. */
function Panel({ seed }: DecorProps) {
  const r = rng(seed + 37);
  const side = Math.floor(r() * 4); // 0 left, 1 right, 2 top, 3 bottom
  const portion = 38 + r() * 22;
  const horizontal = side < 2;
  const style: React.CSSProperties = horizontal
    ? { top: 0, bottom: 0, width: `${portion}cqw`, [side === 0 ? "left" : "right"]: 0 }
    : { left: 0, right: 0, height: `${portion}cqh`, [side === 2 ? "top" : "bottom"]: 0 };
  const from = horizontal ? { x: side === 0 ? "-100%" : "100%" } : { y: side === 2 ? "-100%" : "100%" };
  return (
    <motion.div
      className="absolute"
      style={{ ...style, background: PAPER, ...invert }}
      initial={from}
      animate={{ x: 0, y: 0 }}
      transition={{ type: "spring", stiffness: 140, damping: 24, delay: 0.05 }}
    />
  );
}

/* ---------------------------------- under --------------------------------- */

/** Thin lines crossing the stage, drawn in as the line is sung, with nodes at the ends. */
function Network({ seed, revealed, line }: DecorProps) {
  const r = rng(seed + 41);
  const n = 4 + Math.floor(r() * 3);
  const lines = Array.from({ length: n }, () => {
    const vertical = r() < 0.35;
    return vertical
      ? { x1: r() * 100, y1: -5, x2: r() * 100, y2: 105 }
      : { x1: -5, y1: r() * 100, x2: 105, y2: r() * 100 };
  });
  const per = Math.max(1, line.words.length / n);
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      {lines.map((l, i) => {
        const shown = revealed >= i * per;
        return (
          <g key={i}>
            <motion.line
              {...l}
              stroke={PAPER}
              strokeOpacity={0.4}
              strokeWidth={0.18}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: shown ? 1 : 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            />
            <motion.circle
              cx={l.x1 + (l.x2 - l.x1) * 0.5}
              cy={l.y1 + (l.y2 - l.y1) * 0.5}
              r={0.7}
              fill={PAPER}
              initial={{ opacity: 0 }}
              animate={{ opacity: shown ? 0.8 : 0 }}
              transition={{ delay: 0.5 }}
            />
          </g>
        );
      })}
    </svg>
  );
}

/** Outline squares, circles and triangles that spin slowly and pulse on every word. */
function Outlines({ seed, revealed, palette, line }: DecorProps) {
  const r = rng(seed + 53);
  const n = 2 + Math.floor(r() * 2);
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const size = 7 + r() * 14;
        const kind = Math.floor(r() * 3);
        const color = palette.accents[(seed + i) % 3];
        const spin = (r() < 0.5 ? -1 : 1) * (30 + r() * 60);
        return (
          <motion.div
            key={i}
            className="absolute"
            style={{ left: `${6 + r() * 82}cqw`, top: `${6 + r() * 78}cqh`, width: `${size}cqh`, height: `${size}cqh` }}
            initial={{ scale: 0, rotate: 0, opacity: 0 }}
            animate={{ scale: 1, rotate: spin, opacity: 1 }}
            transition={{
              scale: { type: "spring", stiffness: 200, damping: 14, delay: 0.1 + i * 0.15 },
              opacity: { duration: 0.3, delay: 0.1 + i * 0.15 },
              rotate: { duration: lineDuration(line), ease: "linear" },
            }}
          >
            <motion.svg key={revealed} viewBox="0 0 10 10" className="h-full w-full overflow-visible" initial={{ scale: 1.18 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
              {kind === 0 && <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke={color} strokeWidth="0.6" />}
              {kind === 1 && <circle cx="5" cy="5" r="4.5" fill="none" stroke={color} strokeWidth="0.6" />}
              {kind === 2 && <polygon points="5,0.6 9.5,9.4 0.5,9.4" fill="none" stroke={color} strokeWidth="0.6" />}
            </motion.svg>
          </motion.div>
        );
      })}
    </>
  );
}

/** A ring bursts out of a random spot on every new word. */
function Rings({ seed, revealed, palette }: DecorProps) {
  const from = Math.max(0, revealed - 3);
  return (
    <>
      {Array.from({ length: revealed - from }, (_, k) => {
        const i = from + k;
        const r = rng(seed + i * 97);
        const size = 18 + r() * 30;
        return (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${10 + r() * 80}cqw`,
              top: `${10 + r() * 80}cqh`,
              width: `${size}cqh`,
              height: `${size}cqh`,
              marginLeft: `${-size / 2}cqh`,
              marginTop: `${-size / 2}cqh`,
              border: `0.6cqh solid ${palette.accents[i % 3]}`,
            }}
            initial={{ scale: 0.15, opacity: 1 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
          />
        );
      })}
    </>
  );
}

/** Confetti-like squares and dots fly out on every new word. */
function Particles({ seed, revealed, palette }: DecorProps) {
  const from = Math.max(0, revealed - 2);
  return (
    <>
      {Array.from({ length: revealed - from }, (_, k) => {
        const i = from + k;
        const r = rng(seed + i * 131);
        const cx = 20 + r() * 60;
        const cy = 20 + r() * 60;
        return Array.from({ length: 9 }, (_, j) => {
          const angle = (j / 9) * Math.PI * 2 + r();
          const dist = 12 + r() * 22;
          const size = 1 + r() * 2.2;
          return (
            <motion.div
              key={`${i}-${j}`}
              className={`absolute ${j % 2 ? "rounded-full" : ""}`}
              style={{ left: `${cx}cqw`, top: `${cy}cqh`, width: `${size}cqh`, height: `${size}cqh`, background: palette.accents[(i + j) % 3] }}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
              animate={{ x: `${Math.cos(angle) * dist}cqh`, y: `${Math.sin(angle) * dist}cqh`, opacity: 0, rotate: 180 + r() * 180, scale: 0.4 }}
              transition={{ duration: 1.1 + r() * 0.5, ease: [0.16, 1, 0.3, 1] }}
            />
          );
        });
      })}
    </>
  );
}

/** A diagonal stripe band wiping across, stripes drifting continuously. */
function Stripes({ seed, palette }: DecorProps) {
  const r = rng(seed + 71);
  const top = r() < 0.5;
  const height = 28 + r() * 20;
  const color = palette.accents[seed % 3];
  return (
    <motion.div
      className="stripes-move absolute left-[-10cqw] w-[120cqw] opacity-80"
      style={{
        [top ? "top" : "bottom"]: 0,
        height: `${height}cqh`,
        backgroundImage: `repeating-linear-gradient(-45deg, ${color} 0 2.4cqh, transparent 2.4cqh 4.8cqh)`,
      }}
      initial={{ clipPath: "inset(0 100% 0 0)" }}
      animate={{ clipPath: "inset(0 0% 0 0)" }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    />
  );
}

/** A big soft color shape behind the words (the "popping" color block). */
function Blob({ seed, palette, line }: DecorProps) {
  const r = rng(seed + 89);
  const size = 55 + r() * 30;
  const round = r() < 0.6;
  return (
    <motion.div
      className="absolute"
      style={{
        left: `${25 + r() * 50}cqw`,
        top: `${30 + r() * 40}cqh`,
        width: `${size}cqh`,
        height: `${size}cqh`,
        marginLeft: `${-size / 2}cqh`,
        marginTop: `${-size / 2}cqh`,
        borderRadius: round ? "9999px" : "18%",
        // words only ever use accents seed%3 and (seed+1)%3, so this one never hides them
        background: palette.accents[(seed + 2) % 3],
        opacity: 0.8,
      }}
      initial={{ scale: 0, rotate: -20 }}
      animate={{ scale: [0, 1.08, 1], rotate: round ? 0 : 25 }}
      transition={{ scale: { duration: 0.7, ease: [0.16, 1, 0.3, 1] }, rotate: { duration: lineDuration(line), ease: "linear" } }}
    />
  );
}

const UNDER = { network: Network, outlines: Outlines, rings: Rings, particles: Particles, stripes: Stripes, blob: Blob };
const OVER = { bands: Bands, diamond: Diamond, panel: Panel };

export function UnderLayer({ kinds, ...props }: DecorProps & { kinds: UnderDecor[] }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {kinds.map((k) => {
        const C = UNDER[k];
        return <C key={k} {...props} />;
      })}
    </div>
  );
}

export function OverLayer({ kind, ...props }: DecorProps & { kind?: OverDecor }) {
  if (!kind) return null;
  const C = OVER[kind];
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <C {...props} />
    </div>
  );
}
