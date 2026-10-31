"use client";

import { motion } from "motion/react";
import { fitFont, groupRows, softSpring, wordColor, type TemplateProps } from "./shared";

/** Words fly in from huge and blurred, settling into centered rows. Energetic songs. */
export function Zoom({ line, revealed, palette, seed }: TemplateProps) {
  const rows = groupRows(line.words, Math.min(4, Math.max(1, Math.ceil(line.words.length / 2))));
  const fontSize = fitFont(rows.map((row) => row.map((w) => w.text).join(" ")), { maxVw: 15 });
  let k = 0;

  return (
    <div className="flex w-[86cqw] flex-col items-center text-center" style={{ fontSize }}>
      {rows.map((row, ri) => (
        <div key={ri} className="flex flex-wrap justify-center gap-x-[0.25em] leading-[1.02]">
          {row.map((w) => {
            const i = k++;
            const shown = i < revealed;
            return (
              <motion.span
                key={i}
                className="inline-block font-black tracking-tight"
                initial={{ scale: 3, opacity: 0, filter: "blur(24px)" }}
                animate={
                  shown
                    ? { scale: 1, opacity: 1, filter: "blur(0px)" }
                    : { scale: 3, opacity: 0, filter: "blur(24px)" }
                }
                transition={softSpring}
                style={{ color: wordColor(line, i, palette, seed) }}
              >
                {w.text}
              </motion.span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
