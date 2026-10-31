"use client";

import { AnimatePresence, motion } from "motion/react";
import { fitFont, SECONDARY, wordColor, type TemplateProps } from "./shared";

/**
 * Each word melts into the next. The outgoing and incoming words cross-blur, and a
 * threshold filter on the container snaps the soft overlap into liquid, gooey shapes,
 * so letters appear to flow from one word into the other.
 */
export function Morph({ line, revealed, palette, seed }: TemplateProps) {
  const active = Math.max(0, revealed - 1);
  const word = line.words[active];
  const fontSize = fitFont([word?.text ?? ""], { maxVw: 19, heightVh: 38 });

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center">
      <div
        className="relative flex h-[46cqh] w-full items-center justify-center"
        // the shadow would be thresholded into a fat outline, so this layout goes without
        style={{ fontSize, filter: "url(#gooey-threshold)", textShadow: "none" }}
      >
        <AnimatePresence initial={false}>
          {word && (
            <motion.span
              key={active}
              data-fit=""
              className="absolute font-black tracking-tight whitespace-nowrap"
              style={{ color: wordColor(line, active, palette, seed), willChange: "filter, opacity" }}
              initial={{ opacity: 0, filter: "blur(18px)", scale: 0.96 }}
              animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
              exit={{ opacity: 0, filter: "blur(18px)", scale: 1.04 }}
              transition={{ duration: 0.6, ease: [0.65, 0, 0.35, 1] }}
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
        transition={{ delay: 0.2, duration: 0.6 }}
      >
        {line.text}
      </motion.p>
    </div>
  );
}
