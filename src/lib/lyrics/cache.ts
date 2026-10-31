import type { LyricsResult } from "@/lib/types";

/**
 * Lyrics for recently played songs, kept in this browser so they still show when the
 * lyrics service (LRCLIB) is slow or down. Keeps the most recent 150 songs.
 */
const INDEX = "ls:lyrics:index";
const MAX = 150;

export function readCachedLyrics(key: string): LyricsResult | null {
  try {
    const raw = localStorage.getItem(`ls:lyrics:${key}`);
    return raw ? (JSON.parse(raw) as LyricsResult) : null;
  } catch {
    return null;
  }
}

export function writeCachedLyrics(key: string, lyrics: LyricsResult) {
  try {
    const index = (JSON.parse(localStorage.getItem(INDEX) ?? "[]") as string[]).filter((k) => k !== key);
    index.unshift(key);
    for (const old of index.splice(MAX)) localStorage.removeItem(`ls:lyrics:${old}`);
    localStorage.setItem(`ls:lyrics:${key}`, JSON.stringify(lyrics));
    localStorage.setItem(INDEX, JSON.stringify(index));
  } catch {
    // storage full or unavailable: caching is best-effort
  }
}
