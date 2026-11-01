import "server-only";

/**
 * Fixed-window counters for rate limits.
 *
 * With UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN set, counts are shared by every
 * server instance. Otherwise each instance counts on its own (best effort on serverless).
 */

const MAX_MEMORY_KEYS = 10_000;
const memory = new Map<string, { count: number; resetAt: number }>();

function countInMemory(key: string, windowSec: number, now: number) {
  const entry = memory.get(key);
  if (entry && entry.resetAt > now) return ++entry.count;

  memory.delete(key);
  memory.set(key, { count: 1, resetAt: now + windowSec * 1000 });
  if (memory.size > MAX_MEMORY_KEYS) {
    for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
    // still full (e.g. many distinct clients): drop the oldest entries; Maps keep insertion order
    for (const k of memory.keys()) {
      if (memory.size <= MAX_MEMORY_KEYS) break;
      memory.delete(k);
    }
  }
  return 1;
}

async function countInRedis(key: string, windowSec: number): Promise<number | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, String(windowSec), "NX"],
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

/** Count one hit for `name` in the current window; returns the count and when the window ends. */
export async function hit(name: string, windowSec: number) {
  const now = Date.now();
  const window = Math.floor(now / (windowSec * 1000));
  const key = `rl:${name}:${window}`;
  const count = (await countInRedis(key, windowSec)) ?? countInMemory(key, windowSec, now);
  const retryAfterSec = (window + 1) * windowSec - Math.floor(now / 1000);
  return { count, retryAfterSec };
}

/**
 * The visitor's IP. On Vercel, x-real-ip / x-forwarded-for are set by the platform and
 * can't be spoofed. If you self-host, run behind a proxy that overwrites these headers.
 */
export function clientIp(headers: Headers) {
  return headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
