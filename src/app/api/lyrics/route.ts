import { findLyricsSafe } from "@/lib/lyrics/lrclib";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title")?.trim();
  const artist = searchParams.get("artist")?.trim();
  if (!title || !artist) return Response.json({ error: "title and artist are required" }, { status: 400 });

  const durationParam = Number(searchParams.get("duration"));
  const { lyrics, unavailable } = await findLyricsSafe({
    title,
    artist,
    album: searchParams.get("album") ?? undefined,
    duration: Number.isFinite(durationParam) && durationParam > 0 ? durationParam : undefined,
  });

  if (unavailable) {
    // the lyrics service is down: say so (the app retries), and never cache it
    return Response.json({ lyrics: null, unavailable: true }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  return Response.json(
    { lyrics },
    {
      headers: {
        // found lyrics rarely change; cache misses briefly so they can be retried
        "Cache-Control": lyrics
          ? "public, s-maxage=86400, stale-while-revalidate=604800"
          : "public, s-maxage=300",
      },
    },
  );
}
