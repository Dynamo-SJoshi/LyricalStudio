import "server-only";
import type { LyricsResult } from "@/lib/types";
import { cleanArtist, cleanTitle, findLyricsSafe } from "@/lib/lyrics/lrclib";
import { getYouTubeLyrics } from "@/lib/search/youtube-music";

const UA = "LyricalStudio/0.1 (https://github.com/arijit-debug/LyricalStudio-Web)";

/**
 * Free lyrics, best source first:
 *   1. lrcmux (https://lrcmux.dev, open source): aggregates public providers and returns
 *      word-synced lyrics where available (e.g. Deezer), otherwise line-synced
 *   2. LRCLIB: line-synced
 *   3. YouTube Music: licensed plain lyrics (Musixmatch / LyricFind)
 *   4. lyrics.ovh: plain lyrics
 * Plain lyrics have no timing, so the app estimates it, and `upgradeLater` tells the app
 * to keep checking for synced ones.
 */
export async function findLyricsAnySource(opts: {
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  videoId?: string;
}): Promise<{ lyrics: LyricsResult | null; unavailable: boolean; upgradeLater: boolean }> {
  const mux = await lrcmux(opts).catch(() => ({ lyrics: null, down: true }));
  if (mux.lyrics?.synced || mux.lyrics?.instrumental) return { lyrics: mux.lyrics, unavailable: false, upgradeLater: false };

  const lrclib = await findLyricsSafe(opts);
  if (lrclib.lyrics?.synced || lrclib.lyrics?.instrumental) return { ...lrclib, upgradeLater: false };

  // nobody had synced lyrics: if a synced source was unreachable, check again later
  const syncedSourceDown = mux.down || lrclib.unavailable;
  const plain = mux.lyrics ?? lrclib.lyrics;
  if (plain) return { lyrics: plain, unavailable: false, upgradeLater: syncedSourceDown };

  if (opts.videoId) {
    const yt = await getYouTubeLyrics(opts.videoId).catch(() => null);
    if (yt) {
      return {
        lyrics: { source: "youtube", synced: false, wordSynced: false, raw: yt.text, instrumental: false, credit: yt.credit },
        unavailable: false,
        upgradeLater: syncedSourceDown,
      };
    }
  }
  const ovh = await lyricsOvh(opts.artist, opts.title).catch(() => null);
  if (ovh) {
    return {
      lyrics: { source: "lyricsovh", synced: false, wordSynced: false, raw: ovh, instrumental: false, credit: "lyrics.ovh" },
      unavailable: false,
      upgradeLater: syncedSourceDown,
    };
  }
  return { lyrics: null, unavailable: mux.down && lrclib.unavailable, upgradeLater: false };
}

/** lrcmux native API, as enhanced LRC (word timings as <mm:ss.xx> tags when available). */
async function lrcmux(opts: { title: string; artist: string; album?: string; duration?: number }): Promise<{ lyrics: LyricsResult | null; down: boolean }> {
  const q = new URLSearchParams({ artist: cleanArtist(opts.artist), title: cleanTitle(opts.title), format: "lrc" });
  if (opts.album) q.set("album", opts.album);
  if (opts.duration) q.set("duration", String(Math.round(opts.duration)));
  const res = await fetch(`https://api.lrcmux.dev/get?${q}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12000) });
  if (res.status === 404 || res.status === 400) return { lyrics: null, down: false };
  if (!res.ok) return { lyrics: null, down: true }; // 429 rate limit, 5xx
  const text = (await res.text()).trim();
  if (!text) return { lyrics: null, down: false };
  const level = res.headers.get("x-sync-level");
  const provider = res.headers.get("x-source");
  const credit = provider ? `${provider[0].toUpperCase()}${provider.slice(1)} via lrcmux` : "lrcmux";
  const timed = /^\[\d+:\d+(?:\.\d+)?\]/m.test(text);
  if (level === "none" || !timed) {
    return { lyrics: { source: "lrcmux", synced: false, wordSynced: false, raw: text, instrumental: false, credit }, down: false };
  }
  return {
    lyrics: { source: "lrcmux", synced: true, wordSynced: level === "word" || /<\d+:\d+(?:\.\d+)?>/.test(text), raw: text, instrumental: false, credit },
    down: false,
  };
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
