import "server-only";
import type { LyricsResult } from "@/lib/types";
import { cleanArtist, cleanTitle, findLyricsSafe } from "@/lib/lyrics/lrclib";
import { getYouTubeLyrics } from "@/lib/search/youtube-music";

/**
 * Free lyrics, best source first:
 *   1. LRCLIB: time-synced lyrics (the best case)
 *   2. YouTube Music: licensed plain lyrics (Musixmatch / LyricFind), many languages
 *   3. lyrics.ovh: plain lyrics
 * Plain lyrics have no timing, so the app estimates it. `upgradeLater` tells the app
 * to keep checking LRCLIB, so synced lyrics replace the estimate when they appear.
 */
export async function findLyricsAnySource(opts: {
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  videoId?: string;
}): Promise<{ lyrics: LyricsResult | null; unavailable: boolean; upgradeLater: boolean }> {
  const lrclib = await findLyricsSafe(opts);
  if (lrclib.lyrics?.synced || lrclib.lyrics?.instrumental) return { ...lrclib, upgradeLater: false };

  // LRCLIB is down, has nothing, or only has plain text: try the other free sources
  if (opts.videoId) {
    const yt = await getYouTubeLyrics(opts.videoId).catch(() => null);
    if (yt) {
      return {
        lyrics: { source: "youtube", synced: false, wordSynced: false, raw: yt.text, instrumental: false, credit: yt.credit },
        unavailable: false,
        upgradeLater: lrclib.unavailable,
      };
    }
  }
  if (lrclib.lyrics) return { ...lrclib, upgradeLater: false };

  const ovh = await lyricsOvh(opts.artist, opts.title).catch(() => null);
  if (ovh) {
    return {
      lyrics: { source: "lyricsovh", synced: false, wordSynced: false, raw: ovh, instrumental: false, credit: "lyrics.ovh" },
      unavailable: false,
      upgradeLater: lrclib.unavailable,
    };
  }
  return { lyrics: null, unavailable: lrclib.unavailable, upgradeLater: false };
}

async function lyricsOvh(artist: string, title: string): Promise<string | null> {
  const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist(artist))}/${encodeURIComponent(cleanTitle(title))}`, {
    signal: AbortSignal.timeout(10000), // lyrics.ovh can be slow
  });
  if (!res.ok) return null;
  const { lyrics } = (await res.json()) as { lyrics?: string };
  // some entries start with a French "Paroles de la chanson ..." header line
  const text = lyrics?.replace(/^Paroles de la chanson.*\r?\n/i, "").trim();
  return text || null;
}
