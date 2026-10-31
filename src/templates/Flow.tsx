"use client";

import { motion } from "motion/react";
import { fitFontLen, LABEL, lyricShadow, visualLength, wordColor, type TemplateProps } from "./shared";

/** The whole line is visible but dim; words light up as they're sung. For fast or long lines. */
export function Flow({ line, revealed, palette, seed }: TemplateProps) {
  const total = visualLength(line.text);
  const rows = Math.min(4, Math.max(1, Math.ceil(total / 14)));
  const fontSize = fitFontLen(total / rows + 1.5, rows + 0.5, { widthVw: 74, maxVw: 9, heightVh: Math.min(62, 22 * rows) });

  return (
    <motion.p
      className={`flex w-[80cqw] flex-wrap justify-center font-extrabold leading-[1.12] tracking-tight ${line.lang === "ja" ? "" : "gap-x-[0.26em]"}`}
      style={{ fontSize }}
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 28 }}
    >
      {line.words.map((w, i) => {
        const sung = i < revealed;
        const active = i === revealed - 1;
        const color = wordColor(line, i, palette, seed);
        return (
          <span
            key={i}
            data-fit=""
            className="inline-block origin-bottom transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
            // the highlight color appears once the word is sung
            style={{
              color: sung ? color : LABEL,
              textShadow: lyricShadow(sung ? color : undefined),
              opacity: sung ? 1 : 0.32,
              transform: active ? "scale(1.04)" : "scale(1)",
            }}
          >
            {w.text}
          </span>
        );
      })}
    </motion.p>
  );
}
