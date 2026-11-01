import type { LyricsResult } from "@/lib/types";

/**
 * Lyrics for recently played songs, kept in this browser so they still show when the
 * lyrics service (LRCLIB) is slow or down. Keeps the most recent 150 songs.
 */
// v2: lyrics saved before LRCLIB became the main source (and lrcmux had to agree with
// it) may have poor timing, so they're dropped and fetched again
const PREFIX = "ls:lyrics:v2:";
const INDEX = `${PREFIX}index`;
const OLD_INDEX = "ls:lyrics:index";
const MAX = 150;

/** Remove the old (v1) lyrics cache once. */
function dropOldCache() {
  const old = localStorage.getItem(OLD_INDEX);
  if (old === null) return;
  for (const k of JSON.parse(old) as string[]) localStorage.removeItem(`ls:lyrics:${k}`);
  localStorage.removeItem(OLD_INDEX);
}

export function readCachedLyrics(key: string): LyricsResult | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}${key}`);
    return raw ? (JSON.parse(raw) as LyricsResult) : null;
  } catch {
    return null;
  }
}

export function writeCachedLyrics(key: string, lyrics: LyricsResult) {
  try {
    dropOldCache();
    const index = (JSON.parse(localStorage.getItem(INDEX) ?? "[]") as string[]).filter((k) => k !== key);
    index.unshift(key);
    for (const old of index.splice(MAX)) localStorage.removeItem(`${PREFIX}${old}`);
    localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(lyrics));
    localStorage.setItem(INDEX, JSON.stringify(index));
  } catch {
    // storage full or unavailable: caching is best-effort
  }
}
