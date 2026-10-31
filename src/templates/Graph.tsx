"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotionConfig } from "motion/react";
import { animateTo, resolveTiming } from "./waapi";
import { useElementSize } from "@/lib/useElementSize";
import type { LyricWord } from "@/lib/types";
import { LABEL, visualLength, vivid, wordLook, type TemplateProps } from "./shared";
import { Painted } from "./kinetic";

/**
 * A lyric tree. Meaningful words ("HEART", "BELONGS", "YOU") form the trunk, joined
 * by smooth curves in reading order. Small words ("MY", "TO", "THE") are leaves that
 * hang off the word they belong to, so "MY" links to "HEART" and "TO" links to "YOU".
 * Long lines wrap onto more rows and the tree scales to fit, so nothing is ever cut off;
 * the camera drifts gently toward the newest word within the safe area.
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
type Box = { l: number; t: number; r: number; b: number };

/** Rendered width of a label in px (visualLength already estimates uppercase). */
const labelWidth = (text: string, font: number) => visualLength(text) * font;

/**
 * Lay the tree out in rows no wider than `rowWidth`: the trunk flows left to right on a
 * gentle wave and wraps down to the next row, like a branch. Leaves hang below their word.
 */
function layout(words: LyricWord[], W: number, H: number, seed: number, rowWidth: number) {
  const trunkFont = Math.min(H * 0.13, W * 0.075);
  const leafFont = trunkFont * 0.42;
  const gap = W * 0.05;
  const amp = trunkFont * 0.75;
  const phase = (seed % 628) / 100;
  // label above + wave + leaves below + the next row's label
  const rowStep = amp * 2 + trunkFont * 0.75 + leafFont * 2.6 + trunkFont * 1.25 + 14;

  let leaves = words.map((_, i) => isLeaf(words, i));
  if (!leaves.some((l) => !l)) leaves = words.map(() => false);

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
  const leavesWidthOf = (i: number) =>
    words.reduce((a, w, j) => (leaves[j] && parentOf[j] === i ? a + labelWidth(w.text, leafFont) + leafFont * 1.6 : a), 0);

  let x = 0;
  let row = 0;
  let k = 0;
  let inRow = 0;
  let prevTrunk = -1;
  for (let i = 0; i < words.length; i++) {
    if (leaves[i]) continue;
    const lw = leavesWidthOf(i);
    if (prevTrunk < 0) x = lw;
    else {
      const prevWidth = labelWidth(words[prevTrunk].text, nodes[prevTrunk].font) + 10;
      const next = x + Math.max(prevWidth + gap, lw + gap);
      if (inRow > 0 && next + labelWidth(words[i].text, nodes[i].font) + 10 > rowWidth) {
        row++;
        inRow = 0;
        x = lw;
      } else x = next;
    }
    nodes[i].x = x;
    nodes[i].y = row * rowStep + amp * Math.sin(k * 1.25 + phase);
    prevTrunk = i;
    k++;
    inRow++;
  }

  // leaves fan out below-left of their word, away from its label
  for (let i = 0; i < words.length; i++) {
    if (!leaves[i]) continue;
    const p = nodes[parentOf[i]];
    const siblings = words.map((_, j) => j).filter((j) => leaves[j] && parentOf[j] === parentOf[i]);
    const order = siblings.indexOf(i);
    let dx = 0;
    for (let q = siblings.length - 1; q >= order; q--) dx += labelWidth(words[siblings[q]].text, leafFont) + leafFont * 1.6;
    nodes[i].x = p.x - dx;
    nodes[i].y = p.y + trunkFont * 0.75 + (order % 2) * leafFont * 1.3;
  }

  // bounding box of every label and dot
  const box: Box = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
  const add = (l: number, t: number, r: number, b: number) => {
    box.l = Math.min(box.l, l);
    box.t = Math.min(box.t, t);
    box.r = Math.max(box.r, r);
    box.b = Math.max(box.b, b);
  };
  nodes.forEach((n, i) => {
    const w = labelWidth(words[i].text, n.font);
    add(n.x - 8, n.y - 8, n.x + 8, n.y + 8);
    if (n.leaf) add(n.x + 8, n.y + 4, n.x + 8 + w, n.y + 4 + n.font * 1.05);
    else add(n.x + 10, n.y - 10 - n.font * 1.05, n.x + 10 + w, n.y - 10);
  });
  return { nodes, box, rows: row + 1 };
}

function trunkPath(a: Node, b: Node) {
  if (b.y - a.y > Math.abs(b.x - a.x) * 0.2 && b.x < a.x) {
    // wrapping to the next row: swing down and back like a branch
    const midY = (a.y + b.y) / 2;
    return `M ${a.x} ${a.y} C ${a.x + 120} ${midY}, ${b.x - 120} ${midY}, ${b.x} ${b.y}`;
  }
  const dx = (b.x - a.x) / 2;
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

const SAFE_X = 0.05;
const SAFE_Y = 0.08;

export function Graph({ line, revealed, palette, seed }: TemplateProps) {
  const [ref, { width: W, height: H }] = useElementSize<HTMLDivElement>();
  const reduce = useReducedMotionConfig();
  const ready = W > 0 && H > 0;
  const availW = W * (1 - 2 * SAFE_X);
  const availH = H * (1 - 2 * SAFE_Y);

  // try a single row and progressively more wrapping; keep whichever shows the biggest type
  let best: (ReturnType<typeof layout> & { s: number }) | null = null;
  if (ready) {
    for (const f of [Infinity, 2.2, 1.7, 1.35, 1.05, 0.8]) {
      const l = layout(line.words, W, H, seed, availW * f);
      const s = Math.min(1, availW / (l.box.r - l.box.l), availH / (l.box.b - l.box.t));
      if (!best || s > best.s + 0.02 || (Math.abs(s - best.s) <= 0.02 && l.rows < best.rows)) best = { ...l, s };
    }
  }
  const nodes = best?.nodes ?? [];
  const s = best?.s ?? 1;
  const box = best?.box ?? { l: 0, t: 0, r: 0, b: 0 };

  // camera: center the whole tree, then drift gently toward the newest word,
  // but never so far that anything leaves the safe area
  let camX = 0;
  let camY = 0;
  if (ready && best) {
    const bw = (box.r - box.l) * s;
    const bh = (box.b - box.t) * s;
    camX = (W - bw) / 2 - box.l * s;
    camY = (H - bh) / 2 - box.t * s;
    const active = nodes[Math.max(0, revealed - 1)];
    if (active) {
      const slackX = Math.max(0, (availW - bw) / 2);
      const slackY = Math.max(0, (availH - bh) / 2);
      camX += Math.max(-slackX, Math.min(slackX, (W / 2 - (camX + active.x * s)) * 0.3));
      camY += Math.max(-slackY, Math.min(slackY, (H / 2 - (camY + active.y * s)) * 0.3));
    }
  }

  // the camera glides on the compositor thread (smooth even while the page is busy)
  const camRef = useRef<HTMLDivElement>(null);
  const placed = useRef(false);
  useEffect(() => {
    const el = camRef.current;
    if (!ready || !el) return;
    const transform = `translate(${camX}px, ${camY}px) scale(${s})`;
    if (!placed.current || reduce) {
      el.style.transform = transform;
      placed.current = true;
      return;
    }
    animateTo(el, { transform }, resolveTiming({ type: "spring", stiffness: 30, damping: 12, mass: 1 }));
  }, [camX, camY, s, ready, reduce]);

  const edge = vivid(palette.accents[(seed >>> 0) % 3], 0.66);

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden">
      {ready && (
        <div ref={camRef} className="absolute top-0 left-0" style={{ transformOrigin: "0 0", willChange: "transform" }}>
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
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: shown ? 1 : 0.4, opacity: shown ? 1 : 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 18 }}
                />
              );
            })}
          </svg>

          {line.words.map((w, i) => {
            const n = nodes[i];
            const shown = i < revealed;
            return (
              <Painted
                key={i}
                measure
                look={wordLook(line, i, palette, seed)}
                className="absolute! origin-bottom-left font-black leading-none tracking-tight whitespace-nowrap transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{
                  left: n.x + (n.leaf ? 8 : 10),
                  top: n.y + (n.leaf ? 4 : -10),
                  fontSize: n.font,
                  translate: n.leaf ? "0 0" : "0 -100%",
                  opacity: shown ? 1 : 0,
                  transform: shown ? "translateY(0) scale(1)" : "translateY(6px) scale(0.85)",
                }}
              >
                {w.text}
              </Painted>
            );
          })}
        </div>
      )}
    </div>
  );
}
