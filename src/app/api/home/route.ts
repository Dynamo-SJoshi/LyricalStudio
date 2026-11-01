import { connection } from "next/server";
import { getHomeSections } from "@/lib/search";

export async function GET() {
  // fetched live per request (YouTube Music's feed), never prerendered at build time
  await connection();
  try {
    const sections = await getHomeSections();
    return Response.json({ sections }, { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400" } });
  } catch (err) {
    console.error("home feed failed", err);
    return Response.json({ sections: [] }, { status: 502 });
  }
}
