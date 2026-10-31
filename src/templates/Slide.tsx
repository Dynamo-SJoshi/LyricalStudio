"use client";

import { KineticWord } from "./kinetic";
import { fitFont, groupRows, rng, wordColor, type TemplateProps } from "./shared";

/** Huge staggered rows that slide in from the edges and run off the stage, cropped. */
export function Slide({ line, revealed, palette, seed }: TemplateProps) {
  const r = rng(seed + 5);
  const rows = groupRows(line.words, Math.min(3, Math.max(1, Math.ceil(line.words.length / 2))));
  // sized wider than the stage on purpose: rows overflow and get cropped
  const fontSize = fitFont(rows.map((row) => row.map((w) => w.text).join(" ")), { widthVw: 118, maxVw: 20, heightVh: 80 });
  const indentStep = 6 + r() * 8;
  const reverse = r() < 0.5;
  let k = 0;

  return (
    <div className="flex w-full flex-col" style={{ fontSize }}>
      {rows.map((row, ri) => {
        const fromLeft = (ri % 2 === 0) !== reverse;
        const indent = (reverse ? rows.length - 1 - ri : ri) * indentStep - 6;
        return (
          <div key={ri} className="flex gap-x-[0.24em] leading-[1] whitespace-nowrap" style={{ marginLeft: `${indent}cqw` }}>
            {row.map((w) => {
              const i = k++;
              const shown = i < revealed;
              return (
                <KineticWord
                  key={i}
                  shown={shown}
                  from={{ x: fromLeft ? -7 : 7, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 170, damping: 24 }}
                  className="inline-block font-black tracking-tight"
                  style={{ color: wordColor(line, i, palette, seed) }}
                >
                  {w.text}
                </KineticWord>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
