import { getRadio } from "@/lib/search";
import { clientIp } from "@/lib/rate-limit";

/** Songs related to a video (for "Up next" and "Made for you"). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id || !/^[\w-]{6,20}$/.test(id)) return Response.json({ tracks: [] }, { status: 400 });
  // used when radio comes from the official API, which can only search by artist
  const artist = searchParams.get("artist")?.trim().slice(0, 120) || undefined;
  try {
    const tracks = await getRadio(id, clientIp(request.headers), artist);
    return Response.json({ tracks }, { headers: { "Cache-Control": "public, s-maxage=3600" } });
  } catch (err) {
    console.error("radio failed", err);
    return Response.json({ tracks: [] }, { status: 502 });
  }
}
