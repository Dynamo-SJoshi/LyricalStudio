import { getPlaylistTracks } from "@/lib/search";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[\w-]{6,80}$/.test(id)) return Response.json({ tracks: [] }, { status: 400 });
  try {
    const tracks = await getPlaylistTracks(id);
    return Response.json({ tracks }, { headers: { "Cache-Control": "public, s-maxage=3600" } });
  } catch (err) {
    console.error("playlist failed", err);
    return Response.json({ tracks: [] }, { status: 502 });
  }
}
