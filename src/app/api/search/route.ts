import { SearchUnavailableError, searchCatalog, searchTracks } from "@/lib/search";
import { clientIp } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const typeParam = searchParams.get("type");
  if (!q) return Response.json({ tracks: [], songs: [], videos: [] });
  if (q.length > 200) return Response.json({ error: "Query too long" }, { status: 400 });

  try {
    const ip = clientIp(request.headers);
    if (typeParam === "video" || typeParam === "song") {
      const tracks = await searchTracks(q, typeParam, ip);
      return Response.json(
        { tracks, songs: typeParam === "song" ? tracks : [], videos: typeParam === "video" ? tracks : [] },
        { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
      );
    }

    const { songs, videos } = await searchCatalog(q, ip);
    const tracks = [...songs, ...videos];
    return Response.json(
      { tracks, songs, videos },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch (err) {
    console.error("search failed", err);
    const message = err instanceof SearchUnavailableError ? err.message : "Search is unavailable right now. Try again.";
    return Response.json({ error: message }, { status: 502 });
  }
}
