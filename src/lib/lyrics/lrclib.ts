import "server-only";
import type { LyricsResult } from "@/lib/types";

const BASE = "https://lrclib.net/api";
// LRCLIB asks clients to identify themselves.
const HEADERS = {
  "User-Agent": "LyricalStudio/0.1 (https://github.com/arijit-debug/LyricalStudio)",
};

type LrclibRecord = {
  trackName: string;
  artistName: string;
  albumName?: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
};

/** Strip decorations YouTube titles carry that LRCLIB titles usually don't. */
export function cleanTitle(title: string) {
  return title
    .replace(/\s*[([](?:feat|ft|with|prod)\.?[^)\]]*[)\]]/gi, "")
    .replace(/\s*[([][^)\]]*(?:remaster|version|official|lyric|audio|video|mv|live|edit)[^)\]]*[)\]]/gi, "")
    .replace(/\s+-\s+.*(?:remaster|version|edit|mix).*$/i, "")
    .trim();
}

export function cleanArtist(artist: string) {
  return artist.split(/,|&| x | feat\.? | ft\.? /i)[0].trim();
}

/** Set when LRCLIB itself failed (5xx / network), as opposed to "no lyrics for this song". */
class UpstreamDown extends Error {}

async function fetchJson<T>(url: string, attempts = 3): Promise<T | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
      if (res.status === 404) return null;
      if (res.ok) return (await res.json()) as T;
      // 502/503 "server busy" happens on LRCLIB: back off and retry
    } catch {
      // network error or timeout: retry
    }
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  throw new UpstreamDown("LRCLIB unavailable");
}

/** Like findLyrics, but reports whether the lyrics service was unreachable. */
export async function findLyricsSafe(opts: Parameters<typeof findLyrics>[0]): Promise<{ lyrics: LyricsResult | null; unavailable: boolean }> {
  try {
    return { lyrics: await findLyrics(opts), unavailable: false };
  } catch (err) {
    if (err instanceof UpstreamDown) return { lyrics: null, unavailable: true };
    throw err;
  }
}

function toResult(rec: LrclibRecord): LyricsResult | null {
  if (rec.instrumental) {
    return { source: "lrclib", synced: false, wordSynced: false, raw: "", instrumental: true, matchedDuration: rec.duration };
  }
  if (rec.syncedLyrics) {
    return {
      source: "lrclib",
      synced: true,
      // enhanced LRC carries <mm:ss.xx> tags before each word
      wordSynced: /<\d+:\d+(?:\.\d+)?>/.test(rec.syncedLyrics),
      raw: rec.syncedLyrics,
      instrumental: false,
      matchedDuration: rec.duration,
    };
  }
  if (rec.plainLyrics) {
    return { source: "lrclib", synced: false, wordSynced: false, raw: rec.plainLyrics, instrumental: false, matchedDuration: rec.duration };
  }
  return null;
}

export async function findLyrics(opts: {
  title: string;
  artist: string;
  album?: string;
  duration?: number;
}): Promise<LyricsResult | null> {
  const title = cleanTitle(opts.title);
  const artist = cleanArtist(opts.artist);
  const duration = opts.duration ? Math.round(opts.duration) : undefined;

  // 1. Exact lookup (fast, and works even when /search is overloaded)
  const params = new URLSearchParams({ track_name: title, artist_name: artist });
  if (duration) params.set("duration", String(duration));
  let exact: LrclibRecord | null = null;
  let exactDown = false;
  try {
    exact = await fetchJson<LrclibRecord>(`${BASE}/get?${params}`);
  } catch (err) {
    if (!(err instanceof UpstreamDown)) throw err;
    exactDown = true; // still try the search endpoint below
  }
  const exactResult = exact && toResult(exact);
  if (exactResult?.synced || exactResult?.instrumental) return exactResult;

  // 2. Fuzzy search; pick the synced result closest in length to our audio
  let search: LrclibRecord[] | null = null;
  try {
    search = await fetchJson<LrclibRecord[]>(`${BASE}/search?${new URLSearchParams({ track_name: title, artist_name: artist })}`);
  } catch (err) {
    if (exactResult) return exactResult;
    throw err;
  }
  if (exactDown && !search?.length) throw new UpstreamDown("LRCLIB unavailable");
  const candidates = (search ?? [])
    .filter((r) => !duration || Math.abs(r.duration - duration) <= 8)
    .sort((a, b) => {
      const synced = Number(!!b.syncedLyrics) - Number(!!a.syncedLyrics);
      if (synced) return synced;
      return duration ? Math.abs(a.duration - duration) - Math.abs(b.duration - duration) : 0;
    });
  for (const c of candidates) {
    const r = toResult(c);
    if (r) return r;
  }
  return exactResult ?? null;
}
