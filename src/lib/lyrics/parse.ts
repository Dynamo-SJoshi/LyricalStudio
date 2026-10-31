import type { LyricLine, LyricWord } from "@/lib/types";

type RawLine = {
  start: number;
  text: string;
  /** word start times from enhanced LRC, if present */
  wordStarts?: { start: number; text: string }[];
};

const TIME_TAG = /\[(\d+):(\d+(?:\.\d+)?)\]/g;
const WORD_TAG = /<(\d+):(\d+(?:\.\d+)?)>/g;

const toSec = (m: string, s: string) => Number(m) * 60 + Number(s);

/** Parse LRC (including enhanced word-level LRC) into timed lines. */
export function parseLrc(raw: string): RawLine[] {
  let offset = 0;
  const out: RawLine[] = [];
  for (const rawLine of raw.split(/\r?\n/)) {
    const offsetTag = rawLine.match(/^\[offset:\s*([+-]?\d+)\]/i);
    if (offsetTag) {
      offset = Number(offsetTag[1]) / 1000;
      continue;
    }
    const times = [...rawLine.matchAll(TIME_TAG)];
    if (!times.length) continue;
    const body = rawLine.replace(TIME_TAG, "").trim();

    let wordStarts: RawLine["wordStarts"];
    if (WORD_TAG.test(body)) {
      WORD_TAG.lastIndex = 0;
      wordStarts = [];
      const parts = body.split(WORD_TAG);
      // split yields: [before, m, s, text, m, s, text, ...]
      for (let i = 1; i + 2 < parts.length; i += 3) {
        const text = parts[i + 2].trim();
        if (text) wordStarts.push({ start: toSec(parts[i], parts[i + 1]) - offset, text });
      }
    }
    const text = body.replace(WORD_TAG, "").replace(/\s+/g, " ").trim();
    for (const t of times) out.push({ start: Math.max(0, toSec(t[1], t[2]) - offset), text, wordStarts });
  }
  return out.sort((a, b) => a.start - b.start);
}

export function detectLang(text: string): LyricLine["lang"] {
  if (/[぀-ヿㇰ-ㇿ]/.test(text)) return "ja";
  if (/[一-鿿]/.test(text)) return "ja"; // treat Han as Japanese for font choice
  if (/[ऀ-ॿ]/.test(text)) return "hi";
  if (/[가-힯ᄀ-ᇿ]/.test(text)) return "ko";
  if (/[a-z]/i.test(text)) return "en";
  return "other";
}

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("ja", { granularity: "word" })
    : null;

const isKanaParticle = (s: string) => /^[぀-ゟ]{1,2}$/.test(s);
const isPunct = (s: string) => /^[\p{P}\p{S}\s]+$/u.test(s);

/** Split Japanese into short phrases (Cotodama shows phrase chunks, not single characters). */
function splitJapanese(text: string): string[] {
  const chunks: string[] = [];
  for (const part of text.split(/\s+/).filter(Boolean)) {
    if (!segmenter || !/[぀-ヿ一-鿿]/.test(part)) {
      chunks.push(part);
      continue;
    }
    const segs = [...segmenter.segment(part)].map((s) => s.segment);
    let current = "";
    for (const seg of segs) {
      const attach = current && (isPunct(seg) || isKanaParticle(seg) || current.length < 2);
      if (attach && current.length + seg.length <= 7) current += seg;
      else {
        if (current) chunks.push(current);
        current = seg;
      }
    }
    if (current) chunks.push(current);
  }
  return chunks;
}

export function tokenize(text: string, lang: LyricLine["lang"]): string[] {
  if (lang === "ja") return splitJapanese(text);
  return text.split(/\s+/).filter(Boolean);
}

/** Rough "how long does this take to sing" weight per token. */
function weight(token: string, lang: LyricLine["lang"]) {
  const letters = token.replace(/[\p{P}\p{S}]/gu, "");
  if (!letters) return 0.3;
  if (lang === "ja") return letters.length; // ~one mora per kana
  if (lang === "ko") return letters.length;
  if (lang === "hi") return Math.max(1, (letters.match(/[ऀ-हक़-ॡ]/g) ?? []).length * 0.8);
  const syllables = letters.toLowerCase().match(/[aeiouy]+/g)?.length ?? 1;
  return Math.max(1, syllables);
}

/** Seconds a line takes to sing, from its weights (used when the next line is far away). */
const SEC_PER_WEIGHT: Record<LyricLine["lang"], number> = { en: 0.32, ja: 0.16, ko: 0.2, hi: 0.3, other: 0.3 };

/** Lines sharing a timestamp are one lyric plus its romanization/translation. */
function mergeSameTime(raw: RawLine[]): (RawLine & { sub?: string })[] {
  const out: (RawLine & { sub?: string })[] = [];
  for (const r of raw) {
    const prev = out.at(-1);
    if (prev && r.text && prev.text && Math.abs(prev.start - r.start) < 0.05) {
      prev.sub = prev.sub ? `${prev.sub} / ${r.text}` : r.text;
    } else out.push({ ...r });
  }
  return out;
}

export function buildLines(input: RawLine[], songDuration?: number): LyricLine[] {
  const raw = mergeSameTime(input);
  const counts = new Map<string, number>();
  const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  for (const r of raw) if (r.text) counts.set(norm(r.text), (counts.get(norm(r.text)) ?? 0) + 1);

  // Learn this song's singing pace: slow ballads stretch each syllable far longer
  // than rap. Use lines that are followed closely by another line (no instrumental gap).
  const paces: number[] = [];
  for (let i = 0; i < raw.length - 1; i++) {
    const r = raw[i];
    if (!r.text || !raw[i + 1].text) continue;
    const lang = detectLang(r.text);
    const total = tokenize(r.text, lang).reduce((a, t) => a + weight(t, lang), 0);
    const gap = raw[i + 1].start - r.start;
    if (total > 0 && gap > 0.5 && gap < 12) paces.push(gap / total / SEC_PER_WEIGHT[lang]);
  }
  paces.sort((a, b) => a - b);
  // median gap-per-syllable relative to the default; lines usually fill ~85% of their slot
  const paceFactor = paces.length >= 4 ? Math.min(3, Math.max(0.6, paces[paces.length >> 1] * 0.85)) : 1;

  const lines: LyricLine[] = [];
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    if (!r.text) continue; // empty timestamp = instrumental break marker
    const nextRaw = raw[i + 1];
    // an empty timestamped line is the lyric file's own "instrumental starts here" marker
    const explicitBreak = !!nextRaw && !nextRaw.text;
    const next = nextRaw?.start ?? Math.max(r.start + 4, songDuration ?? r.start + 8);
    const gap = Math.max(0.3, next - r.start);
    const lang = detectLang(r.text);

    let words: LyricWord[];
    if (r.wordStarts?.length) {
      let timed = r.wordStarts;
      // Some providers time Japanese per character: regroup into natural phrases,
      // each starting at its first character's real timestamp.
      if (lang === "ja") {
        const chunks = tokenize(r.text, lang);
        if (timed.length > chunks.length) {
          const charStarts: number[] = [];
          for (const w of timed) for (const ch of w.text) if (!/\s/.test(ch)) charStarts.push(w.start);
          let cursor = 0;
          timed = chunks.map((text) => {
            const start = charStarts[Math.min(cursor, charStarts.length - 1)] ?? r.start;
            cursor += [...text].filter((ch) => !/\s/.test(ch)).length;
            return { start, text };
          });
        }
      }
      words = timed.map((w, idx) => ({
        text: w.text,
        start: w.start,
        end: timed[idx + 1]?.start ?? Math.min(next, w.start + 1.2),
      }));
    } else {
      const tokens = tokenize(r.text, lang);
      const weights = tokens.map((t) => weight(t, lang));
      const total = weights.reduce((a, b) => a + b, 0) || 1;
      const estimated = total * SEC_PER_WEIGHT[lang] * paceFactor;
      // don't stretch a short line across a long instrumental gap
      const span = Math.min(gap * 0.95, Math.max(0.6, estimated * 1.1));
      let t = r.start;
      words = tokens.map((text, idx) => {
        const d = (weights[idx] / total) * span;
        const w = { text, start: t, end: t + d };
        t += d;
        return w;
      });
    }

    // backing vocals in parentheses, and words held longer than usual
    let depth = 0;
    const mean = words.reduce((a, w) => a + (w.end - w.start), 0) / Math.max(1, words.length);
    for (const w of words) {
      if (w.text.includes("(")) depth++;
      w.backing = depth > 0;
      if (w.text.includes(")")) depth = Math.max(0, depth - 1);
      w.emphasis = words.length >= 3 && w.end - w.start > mean * 1.7;
    }

    const lastWordEnd = words.at(-1)?.end ?? r.start + 1;
    // Singers often hold a line far longer than our word estimate, so the line stays
    // up until the next one. Only a marked break, a very long silence, or the song's
    // last line ends it early (that's when the instrumental dots appear).
    let end = next;
    if (!explicitBreak && (gap > 14 || !nextRaw)) end = Math.min(next, Math.max(lastWordEnd + 5, r.start + 9));
    lines.push({
      text: r.text,
      start: r.start,
      end,
      words,
      lang,
      repeats: counts.get(norm(r.text)) ?? 1,
      sub: r.sub,
    });
  }
  return lines;
}

/**
 * Plain (unsynced) lyrics: estimate timing. Each line gets time in proportion to how
 * long it takes to sing (syllables / characters); stanza breaks become short pauses;
 * a short intro and outro are left free. Approximate, but follows the song's flow.
 */
export function buildUnsyncedLines(plain: string, songDuration: number): LyricLine[] {
  const rows = plain.split(/\r?\n/).map((t) => t.replace(TIME_TAG, "").trim());
  // weights: sung lines by syllables, a blank line (stanza break) as a pause
  const items: { text: string; w: number }[] = [];
  for (const text of rows) {
    if (!text) {
      if (items.length && items[items.length - 1].text) items.push({ text: "", w: 4 });
      continue;
    }
    // section labels like "[Chorus]" aren't sung
    if (/^\[[^\]]*\]$/.test(text)) continue;
    const lang = detectLang(text);
    const w = tokenize(text, lang).reduce((a, t) => a + weight(t, lang), 0) + 1.5;
    items.push({ text, w });
  }
  while (items.length && !items[items.length - 1].text) items.pop();
  if (!items.some((i) => i.text)) return [];
  const intro = Math.min(12, songDuration * 0.07);
  const outro = Math.min(10, songDuration * 0.05);
  const span = Math.max(10, songDuration - intro - outro);
  const total = items.reduce((a, i) => a + i.w, 0);
  let t = intro;
  const raw: { start: number; text: string }[] = [];
  for (const i of items) {
    raw.push({ start: t, text: i.text });
    t += (i.w / total) * span;
  }
  return buildLines(raw, songDuration);
}

/** Index of the line active at time t (binary search). -1 before the first line. */
export function lineAt(lines: LyricLine[], t: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].start <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}
