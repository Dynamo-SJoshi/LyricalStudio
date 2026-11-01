import "server-only";
import { Innertube } from "youtubei.js";
import type { Track } from "@/lib/types";

let client: Promise<Innertube> | null = null;

function getClient() {
  if (!client) {
    client = Innertube.create({ retrieve_player: false }).catch((err) => {
      client = null; // allow a retry on the next request
      throw err;
    });
  }
  return client;
}

/** YouTube Music thumbnails carry their size in the URL; ask for a sharper one. */
export function upscaleThumb(url?: string, size = 544) {
  if (!url) return undefined;
  if (/=w\d+-h\d+/.test(url)) return url.replace(/=w\d+-h\d+[^&]*/, `=w${size}-h${size}-l90-rj`);
  if (url.includes("i.ytimg.com")) return url.replace(/\/[a-z]*default\.jpg.*$/, "/hqdefault.jpg");
  return url;
}

type MusicItem = {
  id?: string;
  title?: string;
  item_type?: string;
  artists?: { name: string }[];
  authors?: { name: string }[];
  album?: { name: string };
  duration?: { seconds: number };
  thumbnails?: { url: string }[];
};

function toTrack(item: MusicItem, kind: Track["kind"]): Track | null {
  if (!item.id || !item.title) return null;
  const artist = (item.artists ?? item.authors ?? []).map((a) => a.name).join(", ");
  return {
    videoId: item.id,
    title: item.title,
    artist: artist || "Unknown artist",
    album: item.album?.name,
    durationSec: item.duration?.seconds,
    artwork: upscaleThumb(item.thumbnails?.[0]?.url),
    kind,
  };
}

export async function searchTracks(query: string, kind: Track["kind"] = "song"): Promise<Track[]> {
  const yt = await getClient();
  const res = await yt.music.search(query, { type: kind });
  const shelf = kind === "song" ? res.songs : res.videos;
  const items = (shelf?.contents ?? []) as unknown as MusicItem[];
  return items.map((i) => toTrack(i, kind)).filter((t): t is Track => t !== null);
}

/* ------------------------------ home & radio ------------------------------ */

export type PlaylistCard = { id: string; title: string; subtitle?: string; artwork?: string };
export type HomeSection =
  | { title: string; kind: "songs"; tracks: Track[] }
  | { title: string; kind: "playlists"; playlists: PlaylistCard[] };

type TwoRowItem = {
  id?: string;
  item_type?: string;
  title?: { text?: string };
  subtitle?: { text?: string };
  thumbnail?: { url: string }[];
};

/** YouTube Music's own home feed (no account): "Quick picks" songs and regional hit playlists. */
export async function getHomeSections(): Promise<HomeSection[]> {
  const yt = await getClient();
  const home = await yt.music.getHomeFeed();
  const out: HomeSection[] = [];
  for (const section of home.sections ?? []) {
    const s = section as unknown as { header?: { title?: { text?: string } }; contents?: unknown[] };
    const title = s.header?.title?.text;
    const items = s.contents ?? [];
    if (!title || !items.length) continue;
    const songs = (items as MusicItem[])
      .filter((i) => i.item_type === "song" || i.item_type === "video")
      .map((i) => toTrack(i, i.item_type === "song" ? "song" : "video"))
      .filter((t): t is Track => t !== null);
    if (songs.length >= 4) {
      out.push({ title, kind: "songs", tracks: songs });
      continue;
    }
    const playlists = (items as TwoRowItem[])
      .filter((i) => i.id && (i.item_type === "playlist" || i.item_type === "album"))
      .map((i) => ({
        id: i.id!,
        title: i.title?.text ?? "Playlist",
        subtitle: i.subtitle?.text,
        artwork: upscaleThumb(i.thumbnail?.[0]?.url),
      }));
    if (playlists.length) out.push({ title, kind: "playlists", playlists });
  }
  return out;
}

type PanelVideo = {
  video_id?: string;
  title?: { text?: string };
  author?: string;
  artists?: { name: string }[];
  album?: { name: string };
  duration?: { seconds: number };
  thumbnail?: { url: string }[];
};

/** A radio of songs related to `videoId` (YouTube Music's "Up next" automix). */
export async function getRadio(videoId: string): Promise<Track[]> {
  const yt = await getClient();
  const panel = await yt.music.getUpNext(videoId, true);
  return ((panel.contents ?? []) as unknown as PanelVideo[])
    .filter((v) => v.video_id && v.title?.text)
    .map((v) => ({
      videoId: v.video_id!,
      title: v.title!.text!,
      artist: v.artists?.map((a) => a.name).join(", ") || v.author || "Unknown artist",
      album: v.album?.name,
      durationSec: v.duration?.seconds,
      artwork: upscaleThumb(v.thumbnail?.[0]?.url),
      kind: "song" as const,
    }));
}

/** Songs in a YouTube Music playlist or album. */
export async function getPlaylistTracks(id: string): Promise<Track[]> {
  const yt = await getClient();
  const playlist = await yt.music.getPlaylist(id);
  return ((playlist.items ?? []) as unknown as MusicItem[])
    .map((i) => toTrack(i, i.item_type === "video" ? "video" : "song"))
    .filter((t): t is Track => t !== null);
}
