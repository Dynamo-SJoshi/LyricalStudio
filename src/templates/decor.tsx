"use client";

import { motion } from "motion/react";
import type { LyricLine } from "@/lib/types";
import type { Palette } from "@/lib/theme/palette";
import { rng } from "./shared";

/**
 * Scene effects, Liquid Glass style. Everything sits behind the words, is tinted
 * with the song's own palette, and moves with soft, critically damped motion:
 *   - a glass shape (pane, lens or capsule) that slides in and slowly morphs
 *   - a colored bloom of light behind each new word
 *   - glass droplets that drift upward as words are sung
 */
export type GlassKind = "pane" | "lens" | "capsule";

export type FxProps = {
  line: LyricLine;
  revealed: number;
  palette: Palette;
  seed: number;
};

const glide = { type: "spring", stiffness: 60, damping: 16, mass: 1 } as const;

/** Real glass: blur and saturate whatever is behind. Inline so the CSS build cannot strip it. */
const BACKDROP: React.CSSProperties = { backdropFilter: "blur(16px) saturate(180%)", WebkitBackdropFilter: "blur(16px) saturate(180%)" };
const lineDuration = (l: LyricLine) => Math.max(2, l.end - l.start);

/** Words use accents seed%3 and (seed+1)%3; glass uses the third so words never vanish into it. */
const glassTint = (palette: Palette, seed: number) => palette.accents[(seed + 2) % 3];

/** Organic blob outlines the glass morphs between (8-value border-radius). */
const BLOBS = [
  "42% 58% 55% 45% / 48% 42% 58% 52%",
  "58% 42% 46% 54% / 40% 56% 44% 60%",
  "50% 50% 60% 40% / 56% 48% 52% 44%",
];

function Sheen({ delay = 0.2 }: { delay?: number }) {
  return (
    <motion.div
      className="liquid-glass-sheen"
      initial={{ x: "-130%" }}
      animate={{ x: "330%" }}
      transition={{ duration: 1.8, delay, ease: [0.45, 0, 0.2, 1] }}
    />
  );
}

/** A large tinted glass slab sliding in from one side, its outline slowly flowing. */
function Pane({ palette, seed, line }: FxProps) {
  const r = rng(seed + 31);
  const fromLeft = r() < 0.5;
  const width = 44 + r() * 16;
  return (
    <motion.div
      className="liquid-glass absolute"
      style={{
        ...BACKDROP,
        ["--tint" as string]: glassTint(palette, seed),
        top: `${8 + r() * 8}cqh`,
        height: `${70 + r() * 10}cqh`,
        width: `${width}cqw`,
        [fromLeft ? "left" : "right"]: `${2 + r() * 8}cqw`,
      }}
      initial={{ x: fromLeft ? "-70cqw" : "70cqw", opacity: 0, borderRadius: BLOBS[Math.floor(r() * 3)] }}
      animate={{ x: "0cqw", opacity: 1, scaleX: [1, 1.04, 0.98, 1.02], scaleY: [1, 0.97, 1.03, 1], rotate: [0, fromLeft ? 2 : -2] }}
      transition={{
        x: glide,
        opacity: { duration: 0.6 },
        scaleX: { duration: lineDuration(line), ease: "easeInOut" },
        scaleY: { duration: lineDuration(line), ease: "easeInOut" },
        rotate: { duration: lineDuration(line), ease: "easeInOut" },
      }}
    >
      <Sheen />
    </motion.div>
  );
}

/** A round glass lens swelling up behind the words. */
function Lens({ palette, seed, line }: FxProps) {
  const r = rng(seed + 47);
  const size = 62 + r() * 18;
  return (
    <motion.div
      className="liquid-glass absolute top-1/2 left-1/2"
      style={{
        ...BACKDROP,
        ["--tint" as string]: glassTint(palette, seed),
        width: `${size}cqh`,
        height: `${size}cqh`,
        marginLeft: `${-size / 2 + (r() - 0.5) * 30}cqh`,
        marginTop: `${-size / 2}cqh`,
      }}
      initial={{ scale: 0.55, opacity: 0, borderRadius: BLOBS[1] }}
      animate={{ scale: [0.55, 1.04, 1], opacity: 1, scaleX: [1, 1.05, 0.97, 1], rotate: [0, (r() - 0.5) * 40] }}
      transition={{
        scale: { duration: 1.1, ease: [0.16, 1, 0.3, 1] },
        opacity: { duration: 0.5 },
        scaleX: { duration: lineDuration(line), ease: "easeInOut" },
        rotate: { duration: lineDuration(line), ease: "easeInOut" },
      }}
    >
      <Sheen delay={0.35} />
    </motion.div>
  );
}

/** A long glass capsule stretching across behind a row of words. */
function Capsule({ palette, seed, line }: FxProps) {
  const r = rng(seed + 59);
  const fromLeft = r() < 0.5;
  return (
    <motion.div
      className="liquid-glass absolute left-[4cqw] w-[92cqw]"
      style={{
        ...BACKDROP,
        ["--tint" as string]: glassTint(palette, seed),
        top: `${30 + r() * 20}cqh`,
        height: `${24 + r() * 12}cqh`,
        borderRadius: "9999px",
        transformOrigin: fromLeft ? "left center" : "right center",
      }}
      initial={{ scaleX: 0.08, opacity: 0 }}
      animate={{ scaleX: 1, opacity: 1, y: ["0cqh", `${(r() - 0.5) * 8}cqh`] }}
      transition={{
        scaleX: { type: "spring", stiffness: 70, damping: 18 },
        opacity: { duration: 0.4 },
        y: { duration: lineDuration(line), ease: "easeInOut" },
      }}
    >
      <Sheen delay={0.5} />
    </motion.div>
  );
}

/** A soft bloom of colored light behind each newly sung word. */
function Blooms({ revealed, palette, seed }: FxProps) {
  const from = Math.max(0, revealed - 2);
  return (
    <>
      {Array.from({ length: revealed - from }, (_, k) => {
        const i = from + k;
        const r = rng(seed + i * 101);
        const size = 50 + r() * 30;
        return (
          <motion.div
            key={i}
            className="bloom absolute rounded-full"
            style={{
              ["--tint" as string]: palette.accents[(seed + i) % 3],
              left: `${30 + r() * 40}cqw`,
              top: `${30 + r() * 40}cqh`,
              width: `${size}cqh`,
              height: `${size}cqh`,
              marginLeft: `${-size / 2}cqh`,
              marginTop: `${-size / 2}cqh`,
            }}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: [0.5, 1, 1.25], opacity: [0, 0.55, 0] }}
            transition={{ duration: 2.2, ease: "easeOut", times: [0, 0.3, 1] }}
          />
        );
      })}
    </>
  );
}

/** Small glass droplets that rise and sway as words are sung. */
function Droplets({ revealed, palette, seed }: FxProps) {
  const from = Math.max(0, revealed - 3);
  return (
    <>
      {Array.from({ length: revealed - from }, (_, k) => {
        const i = from + k;
        return Array.from({ length: 3 }, (_, j) => {
          const r = rng(seed + i * 131 + j * 17);
          const size = 2.2 + r() * 4;
          const sway = (r() - 0.5) * 8;
          return (
            <motion.div
              key={`${i}-${j}`}
              className="glass-drop absolute"
              style={{
                ["--tint" as string]: palette.accents[(i + j) % 3],
                left: `${8 + r() * 84}cqw`,
                top: `${62 + r() * 30}cqh`,
                width: `${size}cqh`,
                height: `${size}cqh`,
              }}
              initial={{ y: "0cqh", x: "0cqw", opacity: 0, scale: 0.6 }}
              animate={{ y: `${-(26 + r() * 30)}cqh`, x: ["0cqw", `${sway}cqw`, `${-sway / 2}cqw`], opacity: [0, 0.95, 0], scale: [0.6, 1, 0.9] }}
              transition={{ duration: 3.2 + r() * 1.4, ease: "easeOut" }}
            />
          );
        });
      })}
    </>
  );
}

const SHAPES = { pane: Pane, lens: Lens, capsule: Capsule };

export function SceneFx({ glass, droplets, ...props }: FxProps & { glass?: GlassKind; droplets?: boolean }) {
  const Shape = glass ? SHAPES[glass] : null;
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <Blooms {...props} />
      {Shape && <Shape {...props} />}
      {droplets && <Droplets {...props} />}
    </div>
  );
}

/** Instrumental break: a breathing glass lens with three glass beads. */
export function GlassInterlude({ palette, seed }: { palette: Palette; seed: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center" aria-label="Instrumental">
      <motion.div
        className="liquid-glass absolute"
        style={{ ...BACKDROP, ["--tint" as string]: palette.accents[seed % 3], width: "34cqh", height: "34cqh", borderRadius: BLOBS[0] }}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: [0.96, 1.04, 0.96], opacity: 1, rotate: [0, 360] }}
        transition={{
          scale: { duration: 4, repeat: Infinity, ease: "easeInOut" },
          rotate: { duration: 30, repeat: Infinity, ease: "linear" },
          opacity: { duration: 0.6 },
        }}
      />
      <div className="relative flex gap-4">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="glass-drop interlude-dot block size-5"
            style={{ ["--tint" as string]: palette.accents[(seed + i) % 3], animationDelay: `${i * 0.22}s` }}
          />
        ))}
      </div>
    </div>
  );
}
