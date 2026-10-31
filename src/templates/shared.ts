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

/** Lyrics are pure white: maximum contrast on the deep glass background. */
export const LABEL = "#ffffff";
export const SECONDARY = "rgba(235, 235, 245, 0.55)";

/** Apple-like spring: quick, no wobble. */
export const spring = { type: "spring", stiffness: 150, damping: 24.5, mass: 1 } as const;
export const softSpring = { type: "spring", stiffness: 80, damping: 18, mass: 1 } as const;

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
  // lyrics render in uppercase bold, so estimate capital widths
  for (const ch of s.toUpperCase()) {
    if (/[　-ヿ一-鿿가-힯＀-￯]/.test(ch)) n += 1;
    else if (/[ऀ-ॿ]/.test(ch)) n += 0.62;
    else if (/[MW@]/.test(ch)) n += 0.98;
    else if (/[I.,'!|:;]/.test(ch)) n += 0.3;
    else if (ch === "J") n += 0.56;
    else if (ch === " ") n += 0.26;
    else if (/[0-9]/.test(ch)) n += 0.66;
    else n += 0.72;
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

/**
 * Premium type color: pure white, with one vivid, luminous highlight per line in the
 * album's hue (saturated, not pastel), and soft grey for backing vocals.
 */
export function wordColor(line: LyricLine, index: number, palette: Palette, rawSeed: number) {
  const seed = rawSeed >>> 0;
  const w = line.words[index];
  if (w.backing) return SECONDARY;
  return highlightSet(line, seed).has(index) ? vivid(palette.accents[(seed >>> 3) % 3]) : LABEL;
}

const TINY_WORDS = /^(a|an|the|to|of|in|on|at|by|for|and|or|but|so|is|am|are|be|i|i'm|me|my|we|it|oh|ooh|ah|yeah)$/i;
const highlightCache = new Map<string, Set<number>>();

/**
 * Which words of a line are highlighted: chosen at random from the line's real words
 * (not "the", "to", ...), 1 to 4 per line, about a fifth to a third of the words.
 * The seed includes a per-play random value, so every play of a song highlights
 * different words, while repeated lines within one play stay consistent.
 */
export function highlightSet(line: LyricLine, seed: number): Set<number> {
  const key = `${seed}|${line.text}`;
  const hit = highlightCache.get(key);
  if (hit) return hit;
  const r = rng(seed ^ 0x51ed27);
  const usable = line.words.map((w, i) => ({ w, i })).filter(({ w }) => !w.backing);
  let pool = usable.filter(({ w }) => !TINY_WORDS.test(w.text.replace(/[^\p{L}']/gu, "")));
  if (!pool.length) pool = usable;
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const count = Math.max(1, Math.min(4, pool.length, Math.round(line.words.length * (0.18 + r() * 0.17))));
  const out = new Set(pool.slice(0, count).map(({ i }) => i));
  if (highlightCache.size > 2000) highlightCache.clear();
  highlightCache.set(key, out);
  return out;
}

export const langAttr = (lang: LyricLine["lang"]) => (lang === "other" ? undefined : lang);

/* ---------------------------------------------------------------------------
 * Liquid Glass glyphs. The gradient is computed here (not with CSS color-mix,
 * which the CSS build step "lowers" into opaque fallbacks) and handed to the
 * .glass-glyph class through CSS variables.
 * ------------------------------------------------------------------------- */

type RGBA = [number, number, number, number];

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

/** Parses #rgb, #rrggbb, rgb(a)() and hsl(a)() (comma or space separated). */
export function parseColor(c: string): RGBA {
  const hex = c.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((x) => x + x).join("") : hex[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const nums = (c.match(/-?[\d.]+/g) ?? []).map(Number);
  if (/^hsla?/i.test(c.trim())) {
    const [r, g, b] = hslToRgb(nums[0] ?? 0, (nums[1] ?? 0) / 100, (nums[2] ?? 100) / 100);
    return [r, g, b, nums[3] ?? 1];
  }
  if (/^rgba?/i.test(c.trim())) return [nums[0] ?? 255, nums[1] ?? 255, nums[2] ?? 255, nums[3] ?? 1];
  return [245, 245, 247, 1];
}

/** A light, luminous tint of a color (keeps its hue, softens saturation). */
export function pastel(color: string, lightness = 0.84, saturation?: number): string {
  const [r, g, b] = parseColor(color).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) * 60 : max === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const [nr, ng, nb] = hslToRgb(h, saturation ?? Math.min(0.85, Math.max(0.45, s)), lightness);
  return `rgb(${Math.round(nr)}, ${Math.round(ng)}, ${Math.round(nb)})`;
}

/** A vivid, luminous version of a color: same hue, rich saturation, bright enough to read on dark glass. */
export function vivid(color: string, lightness = 0.7): string {
  return pastel(color, lightness, 0.95);
}

/** Depth shadow for every word, plus a glow in the word's own color when it's highlighted. */
export function lyricShadow(color?: string): string {
  const depth = "0 0.035em 0.22em rgba(0, 0, 0, 0.5)";
  if (!color || color === LABEL || color === SECONDARY) return depth;
  const [r, g, b] = parseColor(color);
  return `${depth}, 0 0 0.6em rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, 0.5)`;
}
