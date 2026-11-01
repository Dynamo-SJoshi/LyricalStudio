import { cleanArtist, cleanTitle } from "@/lib/lyrics/lrclib";
import type { TrackMeta } from "@/lib/types";

type ItunesResult = {
  trackName: string;
  artistName: string;
  primaryGenreName?: string;
  artworkUrl100?: string;
};

/** Genre (drives animation style) and high-res artwork from the free iTunes Search API. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title")?.trim().slice(0, 200);
  const artist = searchParams.get("artist")?.trim().slice(0, 200);
  if (!title || !artist) return Response.json({ meta: {} });

  const term = `${cleanArtist(artist)} ${cleanTitle(title)}`;
  let meta: TrackMeta = {};
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?${new URLSearchParams({ term, entity: "song", limit: "1" })}`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (res.ok) {
      const data = (await res.json()) as { results: ItunesResult[] };
      const hit = data.results[0];
      if (hit) {
        meta = {
          genre: hit.primaryGenreName,
          artworkHiRes: hit.artworkUrl100?.replace(/\/\d+x\d+bb\./, "/600x600bb."),
        };
      }
    }
  } catch {
    // metadata is optional; fall through with an empty result
  }
  return Response.json({ meta }, { headers: { "Cache-Control": "public, s-maxage=86400" } });
}
