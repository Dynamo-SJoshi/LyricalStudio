"use client";

import { motion } from "motion/react";
import { spring, wordColor, type TemplateProps } from "./shared";

/** Japanese-style vertical columns, read right to left; each phrase drops in from above. */
export function Vertical({ line, revealed, palette, seed }: TemplateProps) {
  const cols = line.words.length;
  const longest = Math.max(...line.words.map((w) => [...w.text].length));
  const fontSize = `min(${(64 / longest).toFixed(2)}cqh, ${(70 / cols / 1.25).toFixed(2)}cqw, 13cqh)`;

  return (
    <div
      className="flex h-[72cqh] flex-row-reverse items-start justify-center gap-[0.35em]"
      style={{ fontSize }}
    >
      {line.words.map((w, i) => {
        const shown = i < revealed;
        return (
          <div key={i} className="overflow-hidden" style={{ marginTop: `${(i % 3) * 0.6}em` }}>
            <motion.span
              className="block font-black leading-[1.05]"
              style={{ writingMode: "vertical-rl", color: wordColor(line, i, palette, seed) }}
              initial={{ y: "-100%", opacity: 0 }}
              animate={shown ? { y: "0%", opacity: 1 } : { y: "-100%", opacity: 0 }}
              transition={spring}
            >
              {w.text}
            </motion.span>
          </div>
        );
      })}
    </div>
  );
}
