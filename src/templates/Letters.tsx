"use client";

import { motion } from "motion/react";
import { fitFont, glassVars, groupRows, rng, wordColor, type TemplateProps } from "./shared";

/** Each letter flips in on its own, staggered, like a split-flap board. */
export function Letters({ line, revealed, palette, seed }: TemplateProps) {
  const r = rng(seed + 9);
  const fromTop = r() < 0.5;
  const rows = groupRows(line.words, Math.min(4, Math.max(1, Math.ceil(line.words.length / 2))));
  const fontSize = fitFont(rows.map((row) => row.map((w) => w.text).join(" ")), { maxVw: 14 });
  let k = 0;

  return (
    <div className="flex w-[86cqw] flex-col items-center text-center [perspective:800px]" style={{ fontSize }}>
      {rows.map((row, ri) => (
        <div key={ri} className="flex flex-wrap justify-center gap-x-[0.25em] leading-[1.05]">
          {row.map((w) => {
            const i = k++;
            const shown = i < revealed;
            const color = wordColor(line, i, palette, seed);
            return (
              <span key={i} data-fit="" className="inline-flex font-black tracking-tight" style={{ color, ...glassVars(color) }}>
                {[...w.text].map((ch, j) => (
                  <motion.span
                    key={j}
                    className="glass-glyph inline-block origin-center"
                    initial={{ rotateX: fromTop ? 90 : -90, y: fromTop ? "-0.4em" : "0.4em", opacity: 0 }}
                    animate={
                      shown
                        ? { rotateX: 0, y: "0em", opacity: 1 }
                        : { rotateX: fromTop ? 90 : -90, y: fromTop ? "-0.4em" : "0.4em", opacity: 0 }
                    }
                    transition={{ type: "spring", stiffness: 160, damping: 22, delay: shown ? j * 0.03 : 0 }}
                  >
                    {ch}
                  </motion.span>
                ))}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
