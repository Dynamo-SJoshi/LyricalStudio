"use client";

import { useEffect } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform, useVelocity } from "motion/react";
import { useElementSize } from "@/lib/useElementSize";
import type { LyricWord } from "@/lib/types";
import { blurFor } from "./kinetic";
import { LABEL, visualLength, wordColor, type TemplateProps } from "./shared";

/**
 * A lyric tree. Meaningful words ("HEART", "BELONGS", "YOU") form the trunk, joined
 * by smooth curves in reading order. Small words ("MY", "TO", "THE") are leaves that
 * hang off the word they belong to, so "MY" links to "HEART" and "TO" links to "YOU".
 * The camera glides along the trunk (with motion blur) to keep the newest word in view.
 */

const SMALL_WORDS = new Set([
  // English function words
  "a", "an", "the", "to", "of", "in", "on", "at", "by", "for", "from", "with", "into", "onto",
  "my", "your", "his", "her", "our", "their", "its", "and", "or", "but", "so", "as", "if",
  "is", "am", "are", "was", "be", "been", "i", "i'm", "it", "it's", "me", "we", "you're", "that",
  "this", "just", "all", "up", "out",
  // romanized Hindi particles
  "ka", "ki", "ke", "ko", "se", "hai", "hain", "ne", "na", "bhi", "toh",
]);

const clean = (t: string) => t.toLowerCase().replace(/[^\p{L}']/gu, "");

function isLeaf(words: LyricWord[], i: number) {
  if (words[i].emphasis || i === words.length - 1) return false;
  const t = clean(words[i].text);
  return SMALL_WORDS.has(t) || (t.length <= 2 && /^[a-z']+$/.test(t));
}

type Node = { x: number; y: number; font: number; leaf: boolean; parent: number };

function layout(words: LyricWord[], W: number, H: number, seed: number) {
  const trunkFont = Math.min(H * 0.13, W * 0.075);
  const leafFont = trunkFont * 0.42;
  const gap = W * 0.05;
  const amp = H * 0.13;
  const phase = (seed % 628) / 100;
  const mid = H * 0.56;

  let leaves = words.map((_, i) => isLeaf(words, i));
  if (leaves.every(Boolean) || !leaves.some((l) => !l)) leaves = words.map(() => false);

  // each leaf belongs to the next trunk word (determiners/prepositions lead into it)
  const parentOf = words.map((_, i) => {
    if (!leaves[i]) return i;
    for (let j = i + 1; j < words.length; j++) if (!leaves[j]) return j;
    for (let j = i - 1; j >= 0; j--) if (!leaves[j]) return j;
    return i;
  });

  const nodes: Node[] = words.map((w, i) => ({
    x: 0,
    y: 0,
    font: leaves[i] ? leafFont : w.emphasis ? trunkFont * 1.2 : trunkFont,
    leaf: leaves[i],
    parent: parentOf[i],
  }));

  // trunk: steady left-to-right steps on a gentle wave
  let x = 0;
  let k = 0;
  let prevTrunk = -1;
  for (let i = 0; i < words.length; i++) {
    if (leaves[i]) continue;
    const myLeaves = words.filter((_, j) => leaves[j] && parentOf[j] === i);
    const leavesWidth = myLeaves.reduce((a, w) => a + labelWidth(w.text, leafFont) + leafFont * 1.6, 0);
    if (prevTrunk >= 0) {
      // the previous label starts 10px right of its node
      const prevWidth = labelWidth(words[prevTrunk].text, nodes[prevTrunk].font) + 10;
      x += Math.max(prevWidth + gap, leavesWidth + gap);
    }
    nodes[i].x = x;
    nodes[i].y = mid + amp * Math.sin(k * 1.25 + phase);
    prevTrunk = i;
    k++;
  }

  // leaves: fanned out below-left of their parent, away from the parent's label
  for (let i = 0; i < words.length; i++) {
    if (!leaves[i]) continue;
    const p = nodes[parentOf[i]];
    const siblings = words.map((_, j) => j).filter((j) => leaves[j] && parentOf[j] === parentOf[i]);
    const order = siblings.indexOf(i);
    const below = p.y < H * 0.62;
    let dx = 0;
    for (let s = siblings.length - 1; s >= order; s--) dx += labelWidth(words[siblings[s]].text, leafFont) + leafFont * 1.6;
    nodes[i].x = p.x - dx;
    nodes[i].y = p.y + (below ? 1 : -1) * (H * 0.16 + (order % 2) * H * 0.06);
  }

  const last = nodes.reduce((a, n, i) => Math.max(a, n.x + 10 + labelWidth(words[i].text, n.font)), 0);
  const first = Math.min(...nodes.map((n) => n.x));
  return { nodes, first, last };
}

/** Rendered width of a label in px: bold uppercase runs ~15% wider than visualLength's estimate. */
const labelWidth = (text: string, font: number) => visualLength(text.toUpperCase()) * font * 1.15;

function trunkPath(a: Node, b: Node) {
  const dx = (b.x - a.x) / 2;
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

export function Graph({ line, revealed, palette, seed }: TemplateProps) {
  const [ref, { width: W, height: H }] = useElementSize<HTMLDivElement>();
  const reduce = useReducedMotion();
  const ready = W > 0 && H > 0;
  const { nodes, first, last } = ready ? layout(line.words, W, H, seed) : { nodes: [], first: 0, last: 0 };

  // camera: if the whole tree fits, center it; otherwise keep the newest word at ~40% width
  const active = nodes[Math.max(0, revealed - 1)];
  const span = last - first;
  let camX = 0;
  if (ready) {
    if (span <= W * 0.86) camX = (W - span) / 2 - first;
    else camX = Math.min(W * 0.06 - first, Math.max(W * 0.94 - last, W * 0.4 - (active?.x ?? 0)));
  }

  const x = useMotionValue(camX);
  const vx = useVelocity(x);
  const filter = useTransform(() => (reduce ? "none" : blurFor(vx.get(), 0)));
  useEffect(() => {
    if (!ready) return;
    const c = animate(x, camX, reduce ? { duration: 0 } : { type: "spring", stiffness: 70, damping: 20, mass: 1 });
    return () => c.stop();
  }, [camX, ready, reduce, x]);

  const edge = palette.accents[(seed >>> 0) % 3];

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden">
      {ready && (
        <motion.div className="absolute top-0 left-0" style={{ x, filter }}>
          <svg className="absolute top-0 left-0 overflow-visible" width={1} height={1} aria-hidden>
            {nodes.map((n, i) => {
              const shown = i < revealed;
              if (n.leaf) {
                const p = nodes[n.parent];
                return (
                  <motion.line
                    key={`e${i}`}
                    x1={n.x}
                    y1={n.y}
                    x2={p.x}
                    y2={p.y}
                    stroke={LABEL}
                    strokeOpacity={0.55}
                    strokeWidth={1.5}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: shown ? 1 : 0 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  />
                );
              }
              // trunk edge from the previous trunk word
              let prev = -1;
              for (let j = i - 1; j >= 0; j--) if (!nodes[j].leaf) { prev = j; break; }
              if (prev < 0) return null;
              return (
                <motion.path
                  key={`e${i}`}
                  d={trunkPath(nodes[prev], n)}
                  fill="none"
                  stroke={edge}
                  strokeWidth={3}
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: shown ? 1 : 0 }}
                  transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                />
              );
            })}
            {nodes.map((n, i) => {
              const shown = i < revealed;
              const r = n.leaf ? 4 : 7;
              return (
                <motion.circle
                  key={`n${i}`}
                  cx={n.x}
                  cy={n.y}
                  r={r}
                  fill={n.leaf ? LABEL : edge}
                  initial={{ scale: 0.4, opacity: 0.25 }}
                  animate={{ scale: shown ? 1 : 0.4, opacity: shown ? 1 : 0.25 }}
                  transition={{ type: "spring", stiffness: 400, damping: 18 }}
                />
              );
            })}
          </svg>

          {line.words.map((w, i) => {
            const n = nodes[i];
            const shown = i < revealed;
            return (
              <motion.span
                key={i}
                className="absolute origin-bottom-left font-black leading-none tracking-tight whitespace-nowrap"
                style={{
                  left: n.x + (n.leaf ? 8 : 10),
                  top: n.y + (n.leaf ? 4 : -10),
                  fontSize: n.font,
                  translate: n.leaf ? "0 0" : "0 -100%",
                  color: wordColor(line, i, palette, seed),
                }}
                initial={{ opacity: 0.18, scale: 0.85, y: 6 }}
                animate={shown ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0.18, scale: 0.85, y: 6 }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
              >
                {w.text}
              </motion.span>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
