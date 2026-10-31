"use client";

import { KineticWord } from "./kinetic";
import { fitFontLen, rng, spring, visualLength, wordColor, type TemplateProps } from "./shared";

/** A collage: words in different sizes, offsets and the odd vertical word. */
export function Scatter({ line, revealed, palette, seed }: TemplateProps) {
  const r = rng(seed);
  const total = line.words.reduce((a, w) => a + visualLength(w.text), 0);
  // aim for ~3 rows of text at the base size
  const base = fitFontLen(total / 3 + 1, 3, { maxVw: 11, heightVh: 55 });
  const layout = line.words.map((w) => ({
    scale: 0.65 + r() * 0.6,
    rotate: w.text.length <= 6 && r() < 0.22 ? -90 : 0,
    offset: (r() - 0.5) * 0.5,
    fromX: (r() - 0.5) * 3,
    fromY: (r() - 0.5) * 2,
  }));

  return (
    <div
      className="flex w-[82cqw] flex-wrap items-center justify-center gap-x-[0.35em] gap-y-[0.1em]"
      style={{ fontSize: base }}
    >
      {line.words.map((w, i) => {
        const l = layout[i];
        const shown = i < revealed;
        return (
          <KineticWord
            key={i}
            shown={shown}
            from={{ x: l.fromX, y: l.fromY, opacity: 0, scale: 0.7 }}
            transition={spring}
            className="inline-block font-black leading-none tracking-tight"
            style={{
              fontSize: `${l.scale}em`,
              color: wordColor(line, i, palette, seed),
              writingMode: l.rotate ? "vertical-rl" : undefined,
              translate: `0 ${l.offset}em`,
            }}
          >
            {w.text}
          </KineticWord>
        );
      })}
    </div>
  );
}
