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
