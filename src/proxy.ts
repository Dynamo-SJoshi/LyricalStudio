import { NextResponse, type NextRequest } from "next/server";

/**
 * Per-IP rate limits on the API routes, so one visitor can't burn the YouTube quota
 * or get the server blocked by the free lyrics services.
 *
 * With UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN set, counts are shared by every
 * server instance. Otherwise each instance counts on its own (best effort on serverless).
 * RATE_LIMIT=off turns it off.
 */

const WINDOW_SEC = 60;
/** requests per IP per minute; the first matching prefix wins */
const LIMITS: [prefix: string, limit: number][] = [
  ["/api/search", 30],
  ["/api/radio", 30],
  ["/api/lyrics", 60],
  ["/api/meta", 60],
  ["/api/playlist", 30],
  ["/api/home", 20],
  ["/api/image", 300], // artwork for every row on the home screen
];

const memory = new Map<string, { count: number; resetAt: number }>();

function countInMemory(key: string, now: number) {
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + WINDOW_SEC * 1000 });
    if (memory.size > 10_000) {
      for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
    }
    return 1;
  }
  return ++entry.count;
}

async function countInRedis(key: string): Promise<number | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, String(WINDOW_SEC), "NX"],
      ]),
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    const [incr] = (await res.json()) as { result?: number }[];
    return typeof incr?.result === "number" ? incr.result : null;
  } catch {
    return null; // Redis trouble shouldn't take the app down: fall back to memory
  }
}

function clientIp(request: NextRequest) {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export async function proxy(request: NextRequest) {
  if (process.env.RATE_LIMIT === "off") return NextResponse.next();
  const path = request.nextUrl.pathname;
  const rule = LIMITS.find(([prefix]) => path.startsWith(prefix));
  if (!rule) return NextResponse.next();
  const [prefix, limit] = rule;

  const now = Date.now();
  const window = Math.floor(now / (WINDOW_SEC * 1000));
  const key = `rl:${prefix}:${clientIp(request)}:${window}`;
  const count = (await countInRedis(key)) ?? countInMemory(key, now);

  if (count > limit) {
    const retryAfter = String((window + 1) * WINDOW_SEC - Math.floor(now / 1000));
    return NextResponse.json(
      { error: "Too many requests. Slow down a little and try again." },
      { status: 429, headers: { "Retry-After": retryAfter, "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
