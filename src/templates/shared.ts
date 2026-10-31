import type { LyricLine, LyricWord } from "@/lib/types";
import type { Palette } from "@/lib/theme/palette";

export type TemplateProps = {
  line: LyricLine;
  /** how many words have started (0..words.length) */
  revealed: number;
  palette: Palette;
  /** per-line seed: stable for the same text, so repeated lines look the same */
  seed: number;
};

export const LABEL = "#f5f5f7";
export const SECONDARY = "rgba(235, 235, 245, 0.55)";

/** Apple-like spring: quick, no wobble. */
export const spring = { type: "spring", stiffness: 380, damping: 32, mass: 0.9 } as const;
export const softSpring = { type: "spring", stiffness: 180, damping: 26 } as const;

/** Small deterministic PRNG so layouts are random-looking but stable. */
export function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Approximate rendered width of a string in "em" for bold type. */
export function visualLength(s: string) {
  let n = 0;
  for (const ch of s) {
    if (/[　-ヿ一-鿿가-힯＀-￯]/.test(ch)) n += 1;
    else if (/[ऀ-ॿ]/.test(ch)) n += 0.6;
    else if (/[MWmw@]/.test(ch)) n += 0.85;
    else if (/[ilIj.,'!|:;]/.test(ch)) n += 0.3;
    else if (ch === " ") n += 0.28;
    else n += 0.6;
  }
  return Math.max(n, 0.5);
}

type FitOpts = { widthVw?: number; heightVh?: number; maxVw?: number };

/** Font size for `rowCount` rows whose widest row is `longest` em wide. */
export function fitFontLen(longest: number, rowCount: number, opts: FitOpts = {}) {
  const { widthVw = 82, heightVh = 62, maxVw = 16 } = opts;
  const vw = Math.min(maxVw, widthVw / Math.max(0.5, longest));
  const vh = heightVh / Math.max(1, rowCount) / 1.05;
  return `min(${vw.toFixed(2)}cqw, ${vh.toFixed(2)}cqh)`;
}

/** Font size that fits the given rows inside the stage. */
export function fitFont(rows: string[], opts: FitOpts = {}) {
  return fitFontLen(Math.max(...rows.map(visualLength)), rows.length, opts);
}

/** Group words into at most `maxRows` rows of similar visual width. */
export function groupRows(words: LyricWord[], maxRows: number): LyricWord[][] {
  if (words.length <= maxRows) return words.map((w) => [w]);
  const total = words.reduce((a, w) => a + visualLength(w.text) + 0.3, 0);
  const target = total / maxRows;
  const rows: LyricWord[][] = [[]];
  let width = 0;
  for (const w of words) {
    const len = visualLength(w.text) + 0.3;
    if (width > 0 && width + len / 2 > target && rows.length < maxRows) {
      rows.push([]);
      width = 0;
    }
    rows.at(-1)!.push(w);
    width += len;
  }
  return rows;
}

/** Color for a word: white by default, album accents for emphasis, dim for backing vocals. */
export function wordColor(line: LyricLine, index: number, palette: Palette, rawSeed: number) {
  const seed = rawSeed >>> 0;
  const w = line.words[index];
  if (w.backing) return SECONDARY;
  const accent = palette.accents[seed % 3];
  const mode = (seed >>> 4) % 5;
  // whole line in an album color, the held word in white
  if (mode === 1) return w.emphasis ? LABEL : accent;
  // words alternate between white and an accent
  if (mode === 2) return w.emphasis || index % 2 === 1 ? palette.accents[(seed + 1) % 3] : LABEL;
  // two accents, row-like rhythm
  if (mode === 3) return index % 3 === 2 ? LABEL : palette.accents[(seed + (index % 2)) % 3];
  if (w.emphasis) return accent;
  // if nothing is emphasized, color the longest-held word of longer lines
  if (!line.words.some((x) => x.emphasis) && line.words.length >= 4) {
    let best = 0;
    line.words.forEach((x, i) => {
      if (x.end - x.start > line.words[best].end - line.words[best].start) best = i;
    });
    if (best === index) return accent;
  }
  return LABEL;
}

export const langAttr = (lang: LyricLine["lang"]) => (lang === "other" ? undefined : lang);
