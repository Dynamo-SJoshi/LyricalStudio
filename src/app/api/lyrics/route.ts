import { findLyricsAnySource } from "@/lib/lyrics/sources";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // generous caps on text passed through to the lyrics services
  const title = searchParams.get("title")?.trim().slice(0, 200);
  const artist = searchParams.get("artist")?.trim().slice(0, 200);
  if (!title || !artist) return Response.json({ error: "title and artist are required" }, { status: 400 });

  const durationParam = Number(searchParams.get("duration"));
  const videoId = searchParams.get("videoId") ?? undefined;
  const { lyrics, unavailable, upgradeLater } = await findLyricsAnySource({
    videoId: videoId && /^[\w-]{6,20}$/.test(videoId) ? videoId : undefined,
    title,
    artist,
    album: searchParams.get("album")?.trim().slice(0, 200) || undefined,
    duration: Number.isFinite(durationParam) && durationParam > 0 ? durationParam : undefined,
  });

  if (unavailable) {
    // the lyrics service is down: say so (the app retries), and never cache it
    return Response.json({ lyrics: null, unavailable: true }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  return Response.json(
    { lyrics, upgradeLater },
    {
      headers: {
        // found lyrics rarely change; cache misses briefly so they can be retried
        "Cache-Control": upgradeLater
          ? "no-store"
          : lyrics?.synced
            ? "public, s-maxage=86400, stale-while-revalidate=604800"
            : lyrics
              ? "public, s-maxage=3600"
              : "public, s-maxage=300",
      },
    },
  );
}
