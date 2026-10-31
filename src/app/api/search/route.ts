import { searchTracks } from "@/lib/search/youtube-music";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const kind = searchParams.get("type") === "video" ? "video" : "song";
  if (!q) return Response.json({ tracks: [] });
  if (q.length > 200) return Response.json({ error: "Query too long" }, { status: 400 });

  try {
    const tracks = await searchTracks(q, kind);
    return Response.json(
      { tracks },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch (err) {
    console.error("search failed", err);
    return Response.json({ error: "Search is unavailable right now. Try again." }, { status: 502 });
  }
}
