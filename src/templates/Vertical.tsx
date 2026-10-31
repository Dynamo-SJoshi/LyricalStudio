"use client";

import { KineticWord } from "./kinetic";
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
            <KineticWord
              shown={shown}
              from={{ y: -1.1 * [...w.text].length, opacity: 0, scaleY: 1.4, scaleX: 0.85 }}
              transition={spring}
              className="block font-black leading-[1.05]"
              style={{ writingMode: "vertical-rl", color: wordColor(line, i, palette, seed) }}
            >
              {w.text}
            </KineticWord>
          </div>
        );
      })}
    </div>
  );
}
