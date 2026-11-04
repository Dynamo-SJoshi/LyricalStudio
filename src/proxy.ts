import { NextResponse, type NextRequest } from "next/server";
import { clientIp, hit } from "@/lib/rate-limit";

/**
 * Per-IP rate limits on the API routes, so one visitor can't burn the YouTube quota
 * or get the server blocked by the free lyrics services. See src/lib/rate-limit.ts for
 * how counts are stored. RATE_LIMIT=off turns it off.
 */

/** requests per IP per minute; the first matching prefix wins */
const LIMITS: [prefix: string, limit: number][] = [
  ["/api/search", 30],
  ["/api/radio", 30],
  ["/api/lyrics", 60],
  ["/api/romanize", 20],
  ["/api/meta", 60],
  ["/api/playlist", 30],
  ["/api/home", 20],
  ["/api/image", 300], // artwork for every row on the home screen
];

export async function proxy(request: NextRequest) {
  if (process.env.RATE_LIMIT === "off") return NextResponse.next();
  const path = request.nextUrl.pathname;
  const rule = LIMITS.find(([prefix]) => path.startsWith(prefix));
  if (!rule) return NextResponse.next();
  const [prefix, limit] = rule;

  const { count, retryAfterSec } = await hit(`${prefix}:${clientIp(request.headers)}`, 60);
  if (count > limit) {
    return NextResponse.json(
      { error: "Too many requests. Slow down a little and try again." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec), "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
