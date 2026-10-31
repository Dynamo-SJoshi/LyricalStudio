import type { Track } from "@/lib/types";

const RECENT_KEY = "ls:recent";
const MAX_RECENT = 24;

export function readRecent(): Track[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as Track[];
  } catch {
    return [];
  }
}

export function pushRecent(track: Track) {
  const list = readRecent().filter((t) => t.videoId !== track.videoId);
  list.unshift(track);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
}

/** Per-song lyric offset in seconds (positive = lyrics later). Keyed by title+artist so it survives video swaps. */
const offsetKey = (t: Track) => `ls:offset:${t.artist}::${t.title}`.toLowerCase();

export function readOffset(track: Track): number {
  const v = Number(localStorage.getItem(offsetKey(track)));
  return Number.isFinite(v) ? v : 0;
}

export function writeOffset(track: Track, seconds: number) {
  if (Math.abs(seconds) < 0.001) localStorage.removeItem(offsetKey(track));
  else localStorage.setItem(offsetKey(track), seconds.toFixed(2));
}
