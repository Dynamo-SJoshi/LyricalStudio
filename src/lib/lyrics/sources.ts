import "server-only";
import type { LyricsResult } from "@/lib/types";
import { cleanArtist, cleanTitle, findLyricsSafe } from "@/lib/lyrics/lrclib";
import { parseLrc } from "@/lib/lyrics/parse";

const UA = "LyricalStudio/0.1 (https://github.com/arijit-debug/LyricalStudio)";

/**
 * Lyrics, LRCLIB first:
 *   - LRCLIB (https://lrclib.net) is the main source: community-timed, line-synced.
 *   - lrcmux (https://lrcmux.dev) is used only for word-by-word timing, and only when its
 *     line timing agrees with LRCLIB's (or LRCLIB has no synced lyrics to check against).
 *     Its line-only results are never used: they can be badly off (e.g. merged lines).
 * Sources with no timing at all (guessed timing) aren't used.
 */
export async function findLyricsAnySource(opts: {
  title: string;
  artist: string;
  album?: string;
  duration?: number;
}): Promise<{ lyrics: LyricsResult | null; unavailable: boolean }> {
  const [lrclib, words] = await Promise.all([
    findLyricsSafe(opts),
    lrcmuxWordSynced(opts).catch(() => null),
  ]);
  const lrclibSynced = lrclib.lyrics?.synced ? lrclib.lyrics : null;

  if (words && (!lrclibSynced || timingAgrees(words.raw, lrclibSynced.raw))) {
    return { lyrics: words, unavailable: false };
  }
  if (lrclib.lyrics) return { lyrics: lrclib.lyrics, unavailable: false };
  return { lyrics: null, unavailable: lrclib.unavailable };
}

/**
 * Do two LRC files time the same lines the same way? Every LRCLIB line must have an
 * lrcmux line starting within 1.5 s, the first lines within 2 s, and the line counts close.
 */
export function timingAgrees(candidate: string, reference: string): boolean {
  const a = parseLrc(candidate).filter((l) => l.text).map((l) => l.start);
  const b = parseLrc(reference).filter((l) => l.text).map((l) => l.start);
  if (!a.length || !b.length) return false;
  if (Math.abs(a.length - b.length) > Math.max(2, b.length * 0.2)) return false;
  if (Math.abs(a[0] - b[0]) > 2) return false;
  const matched = b.filter((t) => a.some((s) => Math.abs(s - t) <= 1.5)).length;
  return matched / b.length >= 0.85;
}

/** lrcmux as enhanced LRC; returns lyrics only when they carry word-by-word timing. */
async function lrcmuxWordSynced(opts: { title: string; artist: string; album?: string; duration?: number }): Promise<LyricsResult | null> {
  const q = new URLSearchParams({ artist: cleanArtist(opts.artist), title: cleanTitle(opts.title), format: "lrc" });
  if (opts.album) q.set("album", opts.album);
  if (opts.duration) q.set("duration", String(Math.round(opts.duration)));
  const res = await fetch(`https://api.lrcmux.dev/get?${q}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12000) });
  if (!res.ok) return null;
  const text = (await res.text()).trim();
  const wordTimed = res.headers.get("x-sync-level") === "word" || /<\d+:\d+(?:\.\d+)?>/.test(text);
  if (!text || !wordTimed || !/^\[\d+:\d+(?:\.\d+)?\]/m.test(text)) return null;
  const provider = res.headers.get("x-source");
  const credit = provider ? `${provider[0].toUpperCase()}${provider.slice(1)} via lrcmux` : "lrcmux";
  return { source: "lrcmux", synced: true, wordSynced: true, raw: text, instrumental: false, credit };
}
