import { findLyrics } from "@/lib/lyrics/lrclib";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title")?.trim();
  const artist = searchParams.get("artist")?.trim();
  if (!title || !artist) return Response.json({ error: "title and artist are required" }, { status: 400 });

  const durationParam = Number(searchParams.get("duration"));
  const lyrics = await findLyrics({
    title,
    artist,
    album: searchParams.get("album") ?? undefined,
    duration: Number.isFinite(durationParam) && durationParam > 0 ? durationParam : undefined,
  });

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
