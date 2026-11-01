import { SearchUnavailableError, searchTracks } from "@/lib/search";
import { clientIp } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const kind = searchParams.get("type") === "video" ? "video" : "song";
  if (!q) return Response.json({ tracks: [] });
  if (q.length > 200) return Response.json({ error: "Query too long" }, { status: 400 });

  try {
    const tracks = await searchTracks(q, kind, clientIp(request.headers));
    return Response.json(
      { tracks },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch (err) {
    console.error("search failed", err);
    const message = err instanceof SearchUnavailableError ? err.message : "Search is unavailable right now. Try again.";
    return Response.json({ error: message }, { status: 502 });
  }
}
