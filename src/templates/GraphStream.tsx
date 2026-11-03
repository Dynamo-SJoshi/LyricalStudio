"use client";

import { memo, startTransition, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useReducedMotionConfig } from "motion/react";
import type { LyricLine } from "@/lib/types";
import type { Palette } from "@/lib/theme/palette";
import { hashString } from "@/lib/theme/palette";
import { useLiteMode } from "@/lib/perf/useLiteMode";
import { animateTo, resolveTiming } from "./waapi";
import { fitTree, SAFE_X, type Box, type TreeNode } from "./Graph";
import { LABEL, langAttr, lyricShadow, parseColor, rng, vivid, wordColor } from "./shared";

/**
 * Graph mode as one continuous drawing. Consecutive graph lines share a single, endless
 * canvas: each new line's tree grows out of the previous line's last word (a "bridge"
 * branch), and the camera follows the vine instead of restarting.
 *
 * - The canvas covers the whole window (it may run behind the header, the control bar and
 *   the video tile); the line being sung is centered on screen and sized to fit the area
 *   that's symmetric around the center inside the stage, so it is never cut off.
 * - Each line is fitted like the single-line Graph (fitTree) with an "organic" layout:
 *   word heights wander at random, spacing varies, curves bend differently, and each next
 *   line hangs below the last one with a random sideways shift.
 * - Ended lines stay on screen, dimmed and softly blurred, while they move up: the last two
 *   stay, the third fades out (an exception to the no-residue rule, owner's choice). The
 *   blur is faked cheaply (no CSS filter): text-shadow on transparent text, and wide faint
 *   strokes for their branches.
 *
 * Scale is baked into positions and font sizes, and the camera only translates, so text is
 * never scaled at rest. The camera, the fades and the branch drawing all run on the
 * compositor or as CSS transitions (no JavaScript per frame). On slow machines lite mode
 * (useLiteMode) drops the blurred copies and keeps one dimmed line instead of two.
 */

type Placed = {
  nodes: TreeNode[];
  box: Box;
  /** the line's own scale, applied to radii, strokes and label offsets */
  s: number;
  first: number;
  last: number;
  seed: number;
};

/** Each line fits in this share of the stage height, leaving room above for the previous one. */
const LINE_SHARE = 0.66;

/** Gap between one line's tree and the next, as a fraction of the stage height. */
const LINE_GAP = 0.05;

/** Top and bottom margin of the window the current line is fitted into. */
const V_MARGIN = 0.07;

/** Opacity of a line by age: the current line, the two that linger, the one leaving. */
const AGE_OPACITY = [1, 0.6, 0.42, 0];
/** Lite mode: one ended line lingers, dimmed (no blurred copy), then fades. */
const AGE_OPACITY_LITE = [1, 0.45, 0];

/** The blurred copy is drawn this long after a line appears (once it has settled), ms. */
const PREPARE_MS = 900;
/** Sharp-to-blurred cross-fade when a line ends, s. */
const SOFT_FADE_S = 1.1;


type Pt = { x: number; y: number };

/**
 * Font sizes snap down to a fixed scale of steps ~3% apart. Every new font size makes the
 * browser set up that font from scratch during layout (about 1 ms per size on Windows),
 * and fitted lines would otherwise bring ~10 never-seen sizes each, all in the frame the
 * line starts. With steps, sizes repeat and are cached after the first lines. Rounding
 * down never makes a word bigger than it was fitted for.
 */
const FONT_STEP = Math.log(1.03);
function stepFont(px: number) {
  return Math.round(Math.exp(Math.floor(Math.log(px) / FONT_STEP) * FONT_STEP) * 100) / 100;
}

/**
 * Run fn when the browser is idle (or after `timeout` ms at the latest), so work that can
 * wait never lands in the same frame as a line change. Returns a cancel function.
 */
function whenIdle(fn: () => void, timeout = 600) {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(fn, { timeout });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(fn, 60);
  return () => clearTimeout(id);
}

/**
 * A curve from a to b that bends a random amount to either side (seeded, so it's stable
 * for the same line). Rows that wrap back to the left keep the branch-like swing.
 */
function organicPath(a: Pt, b: Pt, r: () => number, bend = 0.25): { d: string; pts: Pt[] } {
  const curve = (c1: Pt, c2: Pt) => ({
    d: `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`,
    // a cubic curve never leaves the hull of its four points
    pts: [a, c1, c2, b],
  });
  if (b.y - a.y > Math.abs(b.x - a.x) * 0.2 && b.x < a.x) {
    const midY = (a.y + b.y) / 2;
    const swing = 70 + r() * 140;
    return curve({ x: a.x + swing, y: midY + (r() - 0.5) * 60 }, { x: b.x - swing, y: midY + (r() - 0.5) * 60 });
  }
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const t1 = 0.15 + r() * 0.3;
  const t2 = 0.55 + r() * 0.3;
  const b1 = (r() * 2 - 1) * len * bend;
  const b2 = (r() * 2 - 1) * len * bend;
  const c1 = { x: a.x + dx * t1 + nx * b1, y: a.y + dy * t1 + ny * b1 };
  const c2 = { x: a.x + dx * t2 + nx * b2, y: a.y + dy * t2 + ny * b2 };
  return curve(c1, c2);
}

function firstTrunk(nodes: TreeNode[]) {
  const i = nodes.findIndex((n) => !n.leaf);
  return i < 0 ? 0 : i;
}
function lastTrunk(nodes: TreeNode[]) {
  for (let i = nodes.length - 1; i >= 0; i--) if (!nodes[i].leaf) return i;
  return nodes.length - 1;
}

/** World positions for lines[from..to]: each tree grows on from the one before, in a random direction. */
function placeRun(lines: LyricLine[], from: number, to: number, songSeed: number, W: number, H: number): Placed[] {
  const out: Placed[] = [];
  for (let k = from; k <= to; k++) {
    const line = lines[k];
    const seed = (songSeed ^ hashString(line.text)) >>> 0;
    const t = fitTree(line.words, W, H, seed, LINE_SHARE, true);
    const first = firstTrunk(t.nodes);
    let ox = 0;
    let oy = 0;
    const prev = out.at(-1);
    if (prev) {
      const r = rng(seed ^ 0x9e3779b9);
      const w = (t.box.r - t.box.l) * t.s;
      const prevMid = (prev.box.l + prev.box.r) / 2;
      // the new tree goes below the previous one, shifted sideways by a random amount;
      // stacking keeps the lingering line on screen next to the new one
      const shift = (r() < 0.5 ? -1 : 1) * W * (0.05 + r() * 0.3);
      const lx = Math.min(prev.box.r - W * 0.1, Math.max(prev.box.l + W * 0.1 - w, prevMid + shift - w / 2));
      const gap = H * LINE_GAP * (0.6 + r());
      const ty = prev.box.b + gap;
      ox = lx - t.box.l * t.s;
      oy = ty - t.box.t * t.s;
    }
    const nodes = t.nodes.map((n) => ({ ...n, x: ox + n.x * t.s, y: oy + n.y * t.s, font: stepFont(n.font * t.s) }));
    out.push({
      nodes,
      box: { l: ox + t.box.l * t.s, t: oy + t.box.t * t.s, r: ox + t.box.r * t.s, b: oy + t.box.b * t.s },
      s: t.s,
      first,
      last: lastTrunk(nodes),
      seed,
    });
  }
  return out;
}

type Props = {
  lines: LyricLine[];
  /** the run of consecutive graph lines: lines[from..to] */
  from: number;
  to: number;
  /** index (into lines) of the line being sung */
  current: number;
  revealed: number;
  palette: Palette;
  /** song seed; each line's seed is derived from it like everywhere else */
  seed: number;
};

type Frame = { vw: number; vh: number; left: number; top: number; fitW: number; fitH: number };

/**
 * The window size, where the stage sits in it, and the area centered on the window that
 * the current line is fitted into.
 */
function useFrame() {
  const ref = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<Frame>({ vw: 0, vh: 0, left: 0, top: 0, fitW: 0, fitH: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const mx = Math.max(r.left, vw - r.right);
      // width: keep clear of the stage's widest side (the video tile's column), so the
      // centered line never runs under it; height: the whole window, minus a margin (the
      // header and control bar fade away in immersive mode)
      setFrame({ vw, vh, left: r.left, top: r.top, fitW: Math.max(vw * 0.45, vw - 2 * mx), fitH: vh * (1 - 2 * V_MARGIN) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);
  return [ref, frame] as const;
}

export function GraphStream({ lines, from, to, current, revealed, palette, seed }: Props) {
  const [ref, frame] = useFrame();
  const { vw, vh, fitW, fitH } = frame;
  const reduce = useReducedMotionConfig();
  const lite = useLiteMode();
  const ready = vw > 0 && fitW > 0;

  const placed = useMemo(
    () => (ready ? placeRun(lines, from, to, seed, fitW, fitH) : []),
    [lines, from, to, seed, fitW, fitH, ready],
  );
  const k = current - from;
  const cur = placed[k];

  // every font size the run will use (with some of its words), to set up ahead of time
  const warm = useMemo(() => {
    const out = new Map<number, { size: number; text: string; lang?: string }>();
    placed.forEach((p, i) => {
      const line = lines[from + i];
      p.nodes.forEach((n, j) => {
        const hit = out.get(n.font);
        if (!hit) out.set(n.font, { size: n.font, text: line.words[j].text, lang: langAttr(line.lang) });
        else if (hit.text.length < 24) hit.text += " " + line.words[j].text;
      });
    });
    return [...out.values()];
  }, [placed, lines, from]);

  /** where the camera rests for line i: that line centered on the window */
  const baseCam = (i: number) => {
    const p = placed[i];
    return { x: vw / 2 - (p.box.l + p.box.r) / 2, y: vh / 2 - (p.box.t + p.box.b) / 2 };
  };

  // camera: center the current line, drifting gently toward the newest word
  let camX = 0;
  let camY = 0;
  if (cur) {
    ({ x: camX, y: camY } = baseCam(k));
    const bw = cur.box.r - cur.box.l;
    const active = cur.nodes[Math.max(0, Math.min(revealed, cur.nodes.length) - 1)];
    if (active) {
      const slackX = Math.max(0, (fitW * (1 - 2 * SAFE_X) - bw) / 2);
      camX += Math.max(-slackX, Math.min(slackX, (vw / 2 - (camX + active.x)) * 0.3));
    }
  }

  // ended lines linger (dim and blurred) until three newer lines have started;
  // seeking backwards clears them
  const [ghosts, setGhosts] = useState<number[]>([]);
  const prevK = useRef(k);
  useEffect(() => {
    const was = prevK.current;
    prevK.current = k;
    if (was === k) return;
    const keep = lite ? 2 : 3;
    setGhosts((g) => (k < was ? [] : [...g, was].filter((i) => i >= k - keep && i < k)));
  }, [k, lite]);

  // the camera glides on the compositor thread; a new line moves a bit faster than the drift
  const camRef = useRef<HTMLDivElement>(null);
  const placedOnce = useRef(false);
  const lastLine = useRef(current);
  useEffect(() => {
    const el = camRef.current;
    if (!cur || !el) return;
    const transform = `translate(${camX}px, ${camY}px)`;
    const newLine = lastLine.current !== current;
    lastLine.current = current;
    if (!placedOnce.current || reduce) {
      el.style.transform = transform;
      placedOnce.current = true;
      return;
    }
    const timing = newLine
      ? { type: "spring" as const, stiffness: 90, damping: 20, mass: 1 }
      : { type: "spring" as const, stiffness: 30, damping: 12, mass: 1 };
    animateTo(el, { transform }, resolveTiming(timing));
  }, [camX, camY, cur, current, reduce]);

  // the next line is built ahead of time, invisible, so starting it never has to create
  // and lay out a whole line in one frame. It is built in idle time after a line change,
  // not in the line change's own frame.
  const [prebuilt, setPrebuilt] = useState(-1);
  useEffect(() => whenIdle(() => startTransition(() => setPrebuilt(k + 1))), [k]);
  const visible = [...ghosts, k, ...(prebuilt === k + 1 ? [k + 1] : [])].filter((i) => i >= 0 && i < placed.length);

  return (
    <div ref={ref} className="absolute inset-0">
      {ready && (
        // the canvas: the whole window, whatever the stage's own size
        <div
          className="absolute overflow-hidden"
          style={{
            left: -frame.left,
            top: -frame.top,
            width: vw,
            height: vh,
          }}
        >
          <div
            ref={camRef}
            className="absolute top-0 left-0"
            style={{ transformOrigin: "0 0", willChange: "transform" }}
          >
            {visible.map((i) => (
              <LineLayer key={from + i} age={k - i} lite={lite}>
                {(soft, drawn) => (
                  <>
                    <Branches
                        p={placed[i]}
                        prev={placed[i - 1]}
                        shownCount={i > k ? 0 : soft ? Infinity : !drawn ? 0 : i === k ? revealed : Infinity}
                        soft={soft}
                        palette={palette}
                      />
                    <LineWords
                      line={lines[from + i]}
                      index={from + i}
                      p={placed[i]}
                      isCurrent={i === k && !soft}
                      pending={i > k}
                      soft={soft}
                      revealed={drawn && i === k ? revealed : 0}
                      palette={palette}
                    />
                  </>
                )}
              </LineLayer>
            ))}
          </div>
          <FontWarmer items={warm} />
        </div>
      )}
    </div>
  );
}

/**
 * Sets up the run's font sizes before they are needed: one size per idle moment, as a
 * hidden span (never painted). The first time a size is laid out, the browser creates
 * that font (~1 ms each on Windows); doing it here keeps that work out of line changes.
 */
const FontWarmer = memo(function FontWarmer({ items }: { items: { size: number; text: string; lang?: string }[] }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= items.length) return;
    return whenIdle(() => setN((x) => x + 1), 1500);
  }, [n, items.length]);
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-0 left-0 overflow-hidden font-black leading-none tracking-tight whitespace-nowrap"
      style={{ visibility: "hidden", width: 0, height: 0 }}
    >
      {items.slice(0, n).map((it) => (
        <span key={it.size} lang={it.lang} className="absolute" style={{ fontSize: it.size }}>
          {it.text}
        </span>
      ))}
    </div>
  );
});

/**
 * One line (its branches and words) on its own layer; its opacity follows its age (see
 * AGE_OPACITY). translateZ(0) gives each line its own GPU layer (only 2-4 lines exist,
 * never a layer per word).
 *
 * The blur is a cross-fade, not a switch: a blurred copy of the line is drawn once, at
 * opacity ~0, after the line has settled (PREPARE_MS), so drawing it never competes with a
 * line flying in. When the line ends, the sharp and blurred copies cross-fade, which is
 * pure compositing (no repaint), so it is smooth.
 */
function LineLayer({
  age,
  lite,
  children,
}: {
  age: number;
  /** lite mode: no blurred copy, ended lines just dim */
  lite: boolean;
  children: (soft: boolean, drawn: boolean) => React.ReactNode;
}) {
  // drawn: one frame after mounting, so the first branches and words animate in (CSS
  // transitions don't run on mount) and the work is spread over two frames
  const [drawn, setDrawn] = useState(false);
  // prepared: the blurred copy exists (invisible); armed: one frame later, so the
  // cross-fade always starts from a copy that is already on screen
  const [prepared, setPrepared] = useState(false);
  const [armed, setArmed] = useState(false);
  const ended = age > 0;
  const started = age >= 0;
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    // prepare once the line has started and settled, or right away if it ended before that
    if (!started || lite) return;
    let cancel = () => {};
    const t = setTimeout(() => (cancel = whenIdle(() => setPrepared(true))), ended ? 0 : PREPARE_MS);
    return () => {
      clearTimeout(t);
      cancel();
    };
  }, [started, ended, lite]);
  useEffect(() => {
    if (!prepared) return;
    const id = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(id);
  }, [prepared]);
  const blurred = ended && armed && !lite;
  const fade = `opacity ${SOFT_FADE_S}s ease-in-out`;
  return (
    <div
      className="absolute top-0 left-0"
      style={{
        // age -1 is the next line, built ahead of time and hidden
        opacity: age < 0 ? 0 : (lite ? AGE_OPACITY_LITE : AGE_OPACITY)[Math.min(age, (lite ? AGE_OPACITY_LITE : AGE_OPACITY).length - 1)],
        // hidden layers aren't drawn at all (opacity 0 alone may still be rasterized)
        visibility: age < 0 ? "hidden" : undefined,
        transition: `opacity ${age <= 0 ? 0.35 : 0.8}s ease-out`,
        transform: "translateZ(0)",
      }}
    >
      <div className="absolute top-0 left-0" style={{ opacity: blurred ? 0 : 1, transition: fade, willChange: "opacity" }}>
        {children(false, drawn)}
      </div>
      {prepared && !lite && (
        <div className="absolute top-0 left-0" aria-hidden style={{ opacity: blurred ? 1 : 0.001, transition: fade, willChange: "opacity" }}>
          {children(true, true)}
        </div>
      )}
    </div>
  );
}

/** A line's words. The blurred copy is transparent text with a soft glow. */
const LineWords = memo(function LineWords({
  line,
  index,
  p,
  isCurrent,
  pending,
  soft,
  revealed,
  palette,
}: {
  line: LyricLine;
  index: number;
  p: Placed;
  isCurrent: boolean;
  /** the next line, built ahead of time: nothing shown yet */
  pending: boolean;
  soft: boolean;
  revealed: number;
  palette: Palette;
}) {
  return (
    <div data-line={isCurrent ? index : undefined} lang={langAttr(line.lang)} aria-hidden={soft || undefined}>
      {line.words.map((w, j) => {
        const n = p.nodes[j];
        const shown = pending ? false : !isCurrent || j < revealed;
        const color = wordColor(line, j, palette, p.seed);
        const [r, g, b] = parseColor(color);
        let shadow: string;
        if (soft) shadow = `0 0 0.07em rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, 0.95)`;
        else shadow = lyricShadow(color);
        return (
          <span
            key={j}
            data-fit={isCurrent ? "" : undefined}
            className="absolute origin-bottom-left font-black leading-none tracking-tight whitespace-nowrap transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{
              left: n.x + (n.leaf ? 8 : 10) * p.s,
              top: n.y + (n.leaf ? 4 : -10) * p.s,
              fontSize: n.font,
              color: soft ? "transparent" : color,
              textShadow: shadow,
              opacity: shown ? 1 : 0,
              // one transform property (no separate translate), so it animates on the compositor
              transform: `translateY(${n.leaf ? "0%" : "-100%"}) ${shown ? "translateY(0px) scale(1)" : "translateY(6px) scale(0.85)"}`,
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
});

/** One line's edges and dots, plus the bridge branch from the previous line. */
type Edge = { key: string; d: string; pts: Pt[]; from: Pt; to: Pt; color: string; width: number; opacity: number; shown: boolean; duration: number };

const DRAW_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
/**
 * Blurred branches: stroke widths (times the sharp width), drawn on top of each other at
 * BLUR_ALPHA each. Overlaps add up to a soft falloff; the steps are close enough that no
 * edge shows.
 */
const BLUR_STEPS = [1.2, 1.8, 2.6, 3.5, 4.6, 5.9, 7.4, 9.2];
const BLUR_ALPHA = 0.085;

/** springy pop for the dots (slight overshoot), as a plain CSS curve */
const POP_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)";

function lineEdges(p: Placed, prev: Placed | undefined, shownCount: number, color: string): Edge[] {
  const nodes = p.nodes;
  const edges: Edge[] = [];
  const r = rng(p.seed ^ 0x6a09e667);
  if (prev) {
    const a = prev.nodes[prev.last];
    const b = nodes[p.first];
    edges.push({ key: "bridge", ...organicPath(a, b, r, 0.4), from: a, to: b, color, width: 3 * p.s, opacity: 1, shown: shownCount > 0, duration: 0.7 });
  }
  nodes.forEach((n, i) => {
    const shown = i < shownCount;
    if (n.leaf) {
      const par = nodes[n.parent];
      edges.push({ key: `e${i}`, d: `M ${par.x} ${par.y} L ${n.x} ${n.y}`, pts: [par, n], from: par, to: n, color: LABEL, width: 1.5 * p.s, opacity: 0.55, shown, duration: 0.55 });
      return;
    }
    let prevTrunk = -1;
    for (let j = i - 1; j >= 0; j--)
      if (!nodes[j].leaf) {
        prevTrunk = j;
        break;
      }
    if (prevTrunk >= 0)
      edges.push({ key: `e${i}`, ...organicPath(nodes[prevTrunk], n, r), from: nodes[prevTrunk], to: n, color, width: 3 * p.s, opacity: 1, shown, duration: 0.55 });
  });
  return edges;
}

function bounds(pts: Pt[], pad: number) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const pt of pts) {
    minX = Math.min(minX, pt.x);
    minY = Math.min(minY, pt.y);
    maxX = Math.max(maxX, pt.x);
    maxY = Math.max(maxY, pt.y);
  }
  return { x: minX - pad, y: minY - pad, w: maxX - minX + 2 * pad, h: maxY - minY + 2 * pad };
}

/**
 * A branch that draws itself in, entirely on the compositor: the curve is painted once,
 * and a clip window slides over it (the clip box moves one way while its content moves
 * back the other way by the same amount, so the curve itself stays put). Both are plain
 * transform transitions, so no frame of the drawing needs the main thread or a repaint.
 * The wipe runs along the branch's main direction.
 */
function WipeEdge({ e, x, y, w, h, d }: { e: Edge; x: number; y: number; w: number; h: number; d: string }) {
  const dx = e.to.x - e.from.x;
  const dy = e.to.y - e.from.y;
  const vertical = Math.abs(dy) > Math.abs(dx) * 0.5;
  const sx = vertical ? 0 : (Math.sign(dx) || 1) * w;
  const sy = vertical ? (Math.sign(dy) || 1) * h : 0;
  // the clip starts one box behind the start, fully off its content
  const t = `transform ${e.duration}s ${DRAW_EASE}`;
  return (
    <div
      className="absolute overflow-hidden"
      style={{ left: x, top: y, width: w, height: h, transform: e.shown ? "translate(0px, 0px)" : `translate(${-sx}px, ${-sy}px)`, transition: t }}
    >
      <div style={{ width: w, height: h, transform: e.shown ? "translate(0px, 0px)" : `translate(${sx}px, ${sy}px)`, transition: t }}>
        <svg className="block" width={w} height={h} viewBox={`${x} ${y} ${w} ${h}`} aria-hidden>
          <path d={d} fill="none" stroke={e.color} strokeWidth={e.width} strokeOpacity={e.opacity} strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

/**
 * Branches. The current line's draw in with compositor-only transitions (WipeEdge, and
 * dots that pop with transform/opacity), so a line drawing never makes the browser
 * repaint or run the main thread per frame (SVG stroke and SVG transform animations
 * both do). Ended lines' blurred copies are one static SVG.
 */
const Branches = memo(function Branches({
  p,
  prev,
  shownCount,
  soft,
  palette,
}: {
  p: Placed;
  prev?: Placed;
  shownCount: number;
  soft: boolean;
  palette: Palette;
}) {
  const color = vivid(palette.accents[p.seed % 3], 0.66);
  const nodes = p.nodes;
  const edges = lineEdges(p, prev, shownCount, color);

  if (soft) {
    // a lingering line's branches go soft like its words, without a CSS filter: each
    // branch is a stack of strokes, each wider and fainter than the last. Where they
    // overlap they add up, so the line is brightest at its center and fades out gradually
    // to both sides, like a real blur (two bands showed hard edges and looked like an
    // outline). The box covers everything it draws (a 1x1 overflow-visible SVG gets
    // clipped on composited layers).
    const b = bounds([...nodes, ...edges.flatMap((e) => e.pts)], 40 * Math.max(1, p.s));
    // branches by look (trunk color, or the label color for leaves)
    const byColor = new Map<string, { color: string; width: number; opacity: number; d: string }>();
    for (const e of edges) {
      const g = byColor.get(e.color);
      if (g) g.d += " " + e.d;
      else byColor.set(e.color, { color: e.color, width: e.width, opacity: e.opacity, d: e.d });
    }
    const groups = [...byColor.values()];
    // dots as circles in one path per color: two arcs each
    const dotGroups = [true, false].map((leaf) => {
      const ns = nodes.filter((n) => n.leaf === leaf);
      return {
        color: leaf ? LABEL : color,
        dots: (m: number) =>
          ns
            .map((n) => {
              const rad = (leaf ? 4 : 7) * p.s * m;
              return `M ${n.x - rad} ${n.y} a ${rad} ${rad} 0 1 0 ${2 * rad} 0 a ${rad} ${rad} 0 1 0 ${-2 * rad} 0`;
            })
            .join(" "),
      };
    });
    return (
      <svg className="absolute" style={{ left: b.x, top: b.y }} width={b.w} height={b.h} viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} aria-hidden>
        {/* one path per blur step and color (all branches in one d): the same pixels as a
            path per branch, but a few elements to lay out instead of ~160 */}
        {BLUR_STEPS.map((k, si) =>
          groups.map((g) => (
            <path key={`${si}-${g.color}`} d={g.d} fill="none" stroke={g.color} strokeWidth={g.width * k} strokeOpacity={g.opacity * BLUR_ALPHA} strokeLinecap="round" />
          )),
        )}
        {BLUR_STEPS.slice(0, 5).map((k, si) =>
          dotGroups.map((g) => (
            <path key={`d${si}-${g.color}`} d={g.dots(0.6 + k * 0.35)} fill={g.color} fillOpacity={BLUR_ALPHA * 1.3} />
          )),
        )}
      </svg>
    );
  }

  return (
    // its own GPU layer, so branches appearing never re-raster the glowing words
    <div className="absolute top-0 left-0" style={{ willChange: "transform" }} aria-hidden>
      {edges.map((e) => {
        const b = bounds(e.pts, e.width * 2 + 2);
        return <WipeEdge key={e.key} e={e} x={b.x} y={b.y} w={b.w} h={b.h} d={e.d} />;
      })}
      {nodes.map((n, i) => {
        const shown = i < shownCount;
        const rad = (n.leaf ? 4 : 7) * p.s;
        return (
          <div
            key={`n${i}`}
            className="absolute rounded-full"
            style={{
              left: n.x - rad,
              top: n.y - rad,
              width: rad * 2,
              height: rad * 2,
              background: n.leaf ? LABEL : color,
              transform: shown ? "scale(1)" : "scale(0.4)",
              opacity: shown ? 1 : 0,
              transition: `transform 0.45s ${POP_EASE}, opacity 0.25s ease-out`,
            }}
          />
        );
      })}
    </div>
  );
});
