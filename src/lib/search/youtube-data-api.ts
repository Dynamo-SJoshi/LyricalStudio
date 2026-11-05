import "server-only";
import type { Track } from "@/lib/types";
import { hit } from "@/lib/rate-limit";

/**
 * Song search through the official YouTube Data API v3 (needs YOUTUBE_API_KEY).
 *
 * Quota: the free 10,000 units/day buys about 100 searches (search.list = 100 units,
 * videos.list = 1), so results are cached in memory on top of the CDN cache, and each
 * visitor gets a daily budget of real API calls (cache hits are free), so one person
 * can't use up the whole site's quota.
 */

const API = "https://www.googleapis.com/youtube/v3";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;

export class QuotaExceededError extends Error {
  constructor() {
    super("YouTube Data API quota exceeded");
  }
}

/** This visitor has used up their own daily share of API searches. */
export class ClientBudgetExceededError extends Error {
  constructor() {
    super("Daily search budget for this visitor used up");
  }
}

const DAY_SEC = 24 * 60 * 60;
/** API searches (cache misses) one visitor may trigger per day; ~101 quota units each */
function dailyBudget() {
  const n = Number(process.env.YOUTUBE_SEARCHES_PER_IP_PER_DAY);
  return Number.isFinite(n) && n > 0 ? n : 25;
}

/** Charge one API search to `clientId`; throws once their daily budget is gone. */
async function spend(clientId: string) {
  const { count } = await hit(`yt-api:${clientId}`, DAY_SEC);
  if (count > dailyBudget()) throw new ClientBudgetExceededError();
}

type SearchItem = {
  id?: { videoId?: string };
  snippet?: { title?: string; channelTitle?: string; thumbnails?: Record<string, { url: string }> };
};
type VideoItem = {
  id: string;
  contentDetails?: { duration?: string };
  status?: { embeddable?: boolean };
};

const cache = new Map<string, { at: number; tracks: Track[] }>();

function cached(key: string) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  // re-insert so the Map's order stays least-recently-used first
  cache.delete(key);
  cache.set(key, entry);
  return entry.tracks;
}

function remember(key: string, tracks: Track[]) {
  cache.set(key, { at: Date.now(), tracks });
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
}

async function call<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY is not set");
  const res = await fetch(`${API}/${path}?${new URLSearchParams({ ...params, key })}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 403) {
    const body = (await res.json().catch(() => null)) as { error?: { errors?: { reason?: string }[] } } | null;
    const reason = body?.error?.errors?.[0]?.reason;
    if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") throw new QuotaExceededError();
  }
  if (!res.ok) throw new Error(`YouTube Data API ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

/** ISO 8601 duration (PT3M21S) to seconds. */
function parseDuration(iso?: string) {
  const m = iso?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return undefined;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) || undefined;
}

/** The API HTML-escapes titles. */
function decode(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

const TOPIC = / - Topic$/;

/**
 * "Artist - Topic" channels hold YouTube Music's album uploads (best lyric timing).
 * Other uploads usually title themselves "Artist - Song (Official Video)".
 */
function toTrack(item: SearchItem, video: VideoItem | undefined): Track | null {
  const videoId = item.id?.videoId;
  const rawTitle = item.snippet?.title;
  if (!videoId || !rawTitle) return null;
  const channel = decode(item.snippet?.channelTitle ?? "");
  const title = decode(rawTitle);
  const thumbs = item.snippet?.thumbnails ?? {};
  const artwork = (thumbs.high ?? thumbs.medium ?? thumbs.default)?.url;
  const durationSec = parseDuration(video?.contentDetails?.duration);

  if (TOPIC.test(channel)) {
    return { videoId, title, artist: channel.replace(TOPIC, ""), durationSec, artwork, kind: "song" };
  }
  const split = title.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  const artist = split ? split[1] : channel.replace(/VEVO$/i, "").replace(/\s*(Official)?$/i, "").trim();
  return { videoId, title: split ? split[2] : title, artist: artist || "Unknown artist", durationSec, artwork, kind: "video" };
}

async function searchVideos(q: string, maxResults: number): Promise<Track[]> {
  const res = await call<{ items?: SearchItem[] }>("search", {
    part: "snippet",
    type: "video",
    videoCategoryId: "10", // Music
    videoEmbeddable: "true",
    maxResults: String(maxResults),
    q,
  });
  const items = res.items ?? [];
  const ids = items.map((i) => i.id?.videoId).filter(Boolean) as string[];
  if (!ids.length) return [];
  // 1 unit: durations (the player checks album uploads against them) and embeddability
  const details = await call<{ items?: VideoItem[] }>("videos", { part: "contentDetails,status", id: ids.join(",") });
  const byId = new Map((details.items ?? []).map((v) => [v.id, v]));
  return items
    .filter((i) => byId.get(i.id?.videoId ?? "")?.status?.embeddable !== false)
    .map((i) => toTrack(i, byId.get(i.id?.videoId ?? "")))
    .filter((t): t is Track => t !== null);
}

export async function searchTracksOfficial(query: string, kind: Track["kind"], clientId: string): Promise<Track[]> {
  const key = `${kind}:${query.toLowerCase()}`;
  const fromCache = cached(key);
  if (fromCache) return fromCache;
  await spend(clientId);
  const found = await searchVideos(query, 15);
  // songs: album uploads first; videos: music videos first
  const tracks = [...found].sort((a, b) => Number(b.kind === kind) - Number(a.kind === kind));
  remember(key, tracks);
  return tracks;
}

export async function searchCatalogOfficial(
  query: string,
  clientId: string,
): Promise<{ songs: Track[]; videos: Track[] }> {
  const key = `catalog:${query.toLowerCase()}`;
  const fromCache = cached(key);
  if (fromCache) {
    return {
      songs: fromCache.filter((t) => t.kind === "song"),
      videos: fromCache.filter((t) => t.kind === "video"),
    };
  }
  await spend(clientId);
  const found = await searchVideos(query, 15);
  remember(key, found);
  return {
    songs: found.filter((t) => t.kind === "song"),
    videos: found.filter((t) => t.kind === "video"),
  };
}

/**
 * Related songs. The Data API no longer offers "related videos", so this searches for
 * more by the same artist (cached per artist, since it costs a full search).
 */
export async function getRadioOfficial(seed: { videoId: string; artist: string }, clientId: string): Promise<Track[]> {
  const key = `radio:${seed.artist.toLowerCase()}`;
  let tracks = cached(key);
  if (!tracks) {
    await spend(clientId);
    tracks = await searchVideos(seed.artist, 25);
    remember(key, tracks);
  }
  return tracks.filter((t) => t.videoId !== seed.videoId);
}
