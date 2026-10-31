"use client";

import { motion } from "motion/react";
import { fitFont, groupRows, rng, spring, wordColor, type TemplateProps } from "./shared";

/** Words stack into big left- or right-aligned rows, each sliding up as it's sung. */
export function Stack({ line, revealed, palette, seed }: TemplateProps) {
  const r = rng(seed);
  const align = r() < 0.5 ? "items-start text-left" : "items-end text-right";
  const rows = groupRows(line.words, Math.min(5, Math.max(2, Math.ceil(line.words.length / 2))));
  const fontSize = fitFont(rows.map((row) => row.map((w) => w.text).join(" ")), { maxVw: 13 });
  let k = 0;

  return (
    <div className={`flex w-[84cqw] flex-col ${align}`} style={{ fontSize }}>
      {rows.map((row, ri) => (
        <div key={ri} className="flex flex-wrap gap-x-[0.25em] overflow-hidden leading-[1.05] pb-[0.06em]">
          {row.map((w) => {
            const i = k++;
            const shown = i < revealed;
            return (
              <motion.span
                key={i}
                className="inline-block font-black tracking-tight"
                initial={{ y: "105%", opacity: 0 }}
                animate={shown ? { y: "0%", opacity: 1 } : { y: "105%", opacity: 0 }}
                transition={spring}
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
