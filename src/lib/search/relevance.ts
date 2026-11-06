import type { Track } from "@/lib/types";

function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/ee/g, "i")
    .replace(/oo/g, "u")
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_WORDS = new Set(["by", "x", "feat", "ft", "and", "the", "a", "an", "of", "in", "to", "for"]);

export function scoreTrackRelevance(track: Track, query: string): number {
  const qRaw = query.toLowerCase().trim();
  const qNorm = normalize(query);
  const qTokens = qNorm.split(" ").filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  const titleRaw = track.title.toLowerCase();
  const titleNorm = normalize(track.title);
  const artistNorm = normalize(track.artist || "");

  let score = 0;

  // 1. Exact phrase matches in title
  if (titleRaw.includes(qRaw)) {
    score += 150;
  } else if (titleNorm.includes(qNorm)) {
    score += 120;
  }

  // 2. Token overlap in title / artist
  let titleTokenMatches = 0;
  for (const token of qTokens) {
    if (titleNorm.includes(token)) {
      titleTokenMatches++;
      score += 40;
      // Bonus for whole-word boundary match
      const wordRegex = new RegExp(`(^|\\s)${token}(\\s|$)`);
      if (wordRegex.test(titleNorm)) {
        score += 20;
      }
    } else if (artistNorm.includes(token)) {
      score += 15;
    }
  }

  // 3. Proportion bonus: if a high ratio of query words appear in the title
  if (qTokens.length > 0) {
    const matchRatio = titleTokenMatches / qTokens.length;
    score += Math.round(matchRatio * 50);
  }

  // 4. Mashup / mix bonus if query requested 'x' or 'mashup'
  if (
    (qRaw.includes(" x ") || qRaw.includes("mashup") || qRaw.includes("remix")) &&
    (titleRaw.includes(" x ") || titleRaw.includes("mashup") || titleRaw.includes("remix"))
  ) {
    score += 30;
  }

  return score;
}

/**
 * Re-orders tracks so that tracks with titles matching the query receive higher priority,
 * while preserving the original recommendations below them with stable sorting.
 */
export function sortByRelevance(tracks: Track[], query: string): Track[] {
  if (!query.trim()) return tracks;
  // Stable sort: higher score first; equal scores retain original order
  return [...tracks].sort((a, b) => scoreTrackRelevance(b, query) - scoreTrackRelevance(a, query));
}
