"use client";

import { motion } from "motion/react";
import { LABEL, rng, visualLength, wordColor, type TemplateProps } from "./shared";

type Node = { x: number; y: number; size: number };

/**
 * Words grow along a branching graph. Each sung word draws an edge from the
 * previous node, side branches sprout from every node, upcoming words wait small
 * and faint at their nodes, and the camera glides to follow the newest word.
 * Units: x in cqw, y in cqh.
 */
export function Graph({ line, revealed, palette, seed }: TemplateProps) {
  const r = rng(seed + 17);
  const nodes: Node[] = [];
  let x = 0;
  let y = 0;
  let dir = r() < 0.5 ? -1 : 1;
  for (const w of line.words) {
    const short = visualLength(w.text) <= 2.2;
    const size = w.emphasis ? 9 : short ? 4.2 : 7;
    nodes.push({ x, y, size });
    // step right by roughly the word's width, zig-zag up/down like branches
    x += visualLength(w.text) * size * 0.62 + 6 + r() * 6;
    dir = r() < 0.7 ? -dir : dir;
    y += dir * (10 + r() * 16);
  }
  const branches = nodes.map(() =>
    Array.from({ length: 1 + Math.floor(r() * 2) }, () => {
      const a = (r() - 0.5) * Math.PI * 1.4 + (r() < 0.5 ? 0 : Math.PI);
      const len = 8 + r() * 14;
      return { dx: Math.cos(a) * len, dy: Math.sin(a) * len };
    }),
  );

  const active = nodes[Math.max(0, revealed - 1)] ?? { x: 0, y: 0 };
  const edgeColor = palette.accents[seed % 3];

  return (
    <div className="absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute top-1/2 left-1/2"
        initial={false}
        animate={{ x: `${-active.x - 4}cqw`, y: `${-active.y}cqh` }}
        transition={{ type: "spring", stiffness: 60, damping: 18 }}
      >
        {/* 1 SVG unit = 1cqw horizontally and 1cqh vertically */}
        <svg
          className="absolute top-0 left-0 overflow-visible"
          style={{ width: "100cqw", height: "100cqh" }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          {nodes.map((n, i) => {
            const shown = i < revealed;
            const prev = nodes[i - 1];
            return (
              <g key={i}>
                {prev && (
                  <motion.line
                    x1={prev.x}
                    y1={prev.y}
                    x2={n.x}
                    y2={n.y}
                    stroke={edgeColor}
                    strokeWidth={0.35}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: shown ? 1 : 0 }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  />
                )}
                {branches[i].map((b, j) => (
                  <g key={j}>
                    <motion.line
                      x1={n.x}
                      y1={n.y}
                      x2={n.x + b.dx}
                      y2={n.y + b.dy}
                      stroke={LABEL}
                      strokeOpacity={0.45}
                      strokeWidth={0.15}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: shown ? 1 : 0 }}
                      transition={{ duration: 0.7, delay: shown ? 0.15 + j * 0.1 : 0 }}
                    />
                    <motion.circle
                      cx={n.x + b.dx}
                      cy={n.y + b.dy}
                      r={0.55}
                      fill={palette.accents[(i + j + 1) % 3]}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: shown ? 1 : 0 }}
                      transition={{ delay: shown ? 0.6 : 0 }}
                    />
                  </g>
                ))}
                <motion.circle
                  cx={n.x}
                  cy={n.y}
                  r={0.9}
                  fill={shown ? edgeColor : LABEL}
                  animate={{ opacity: shown ? 1 : 0.25 }}
                />
              </g>
            );
          })}
        </svg>

        {line.words.map((w, i) => {
          const n = nodes[i];
          const shown = i < revealed;
          return (
            <motion.span
              key={i}
              className="absolute font-black leading-none tracking-tight whitespace-nowrap"
              style={{
                left: `${n.x + 1}cqw`,
                top: `${n.y}cqh`,
                fontSize: `min(${n.size}cqw, ${n.size * 1.6}cqh)`,
                color: wordColor(line, i, palette, seed),
                translate: "0 -110%",
              }}
              initial={{ opacity: 0.2, scale: 0.45, filter: "blur(2px)" }}
              animate={shown ? { opacity: 1, scale: 1, filter: "blur(0px)" } : { opacity: 0.2, scale: 0.45, filter: "blur(2px)" }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
            >
              {w.text}
            </motion.span>
          );
        })}
      </motion.div>
    </div>
  );
}
