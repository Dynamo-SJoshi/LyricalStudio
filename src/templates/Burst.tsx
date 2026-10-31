"use client";

import { AnimatePresence, motion } from "motion/react";
import { fitFont, SECONDARY, spring, wordColor, type TemplateProps } from "./shared";

/** One huge word at a time, popping in center screen. The full line sits small underneath. */
export function Burst({ line, revealed, palette, seed }: TemplateProps) {
  const i = Math.max(0, revealed - 1);
  const word = line.words[i];
  const fontSize = fitFont([word?.text ?? ""], { maxVw: 22, heightVh: 40 });

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center">
      <div className="relative flex h-[50cqh] w-full items-center justify-center" style={{ fontSize }}>
        <AnimatePresence mode="popLayout" initial={false}>
          {revealed > 0 && word && (
            <motion.span
              key={i}
              className="absolute font-black tracking-tighter whitespace-nowrap"
              initial={{ scale: 0.4, opacity: 0, filter: "blur(18px)" }}
              animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
              exit={{ scale: 1.5, opacity: 0, filter: "blur(14px)", transition: { duration: 0.25 } }}
              transition={spring}
              style={{ color: wordColor(line, i, palette, seed) }}
            >
              {word.text}
            </motion.span>
          )}
        </AnimatePresence>
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
