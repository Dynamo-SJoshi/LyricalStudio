import { getRadio } from "@/lib/search/youtube-music";

/** Songs related to a video (for "Up next" and "Made for you"). */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[\w-]{6,20}$/.test(id)) return Response.json({ tracks: [] }, { status: 400 });
  try {
    const tracks = await getRadio(id);
    return Response.json({ tracks }, { headers: { "Cache-Control": "public, s-maxage=3600" } });
  } catch (err) {
    console.error("radio failed", err);
    return Response.json({ tracks: [] }, { status: 502 });
  }
}
