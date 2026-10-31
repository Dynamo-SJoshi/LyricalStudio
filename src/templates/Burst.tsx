"use client";

import { motion } from "motion/react";
import { KineticWord } from "./kinetic";
import { fitFont, SECONDARY, spring, wordColor, type TemplateProps } from "./shared";

/** One huge word at a time, popping in center screen. The full line sits small underneath. */
export function Burst({ line, revealed, palette, seed }: TemplateProps) {
  const active = Math.max(0, revealed - 1);
  const fontSize = fitFont([line.words[active]?.text ?? ""], { maxVw: 22, heightVh: 40 });

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center">
      <div className="relative flex h-[50cqh] w-full items-center justify-center" style={{ fontSize }}>
        {line.words.map((w, i) => (
          // every word stays mounted: the current one zooms in, finished ones blow past the camera
          <KineticWord
            key={i}
            shown={revealed > 0 && i === active}
            from={i < active ? { scale: 1.7, opacity: 0 } : { scale: 0.35, opacity: 0 }}
            transition={i < active ? { duration: 0.28, ease: [0.4, 0, 1, 1] } : spring}
            className="absolute font-black tracking-tighter whitespace-nowrap"
            style={{ color: wordColor(line, i, palette, seed) }}
          >
            {w.text}
          </KineticWord>
        ))}
      </div>
      <motion.p
        className="max-w-[70cqw] text-center text-[clamp(16px,1.6cqw,26px)] font-semibold"
        style={{ color: SECONDARY }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {line.text}
      </motion.p>
    </div>
  );
}
