/**
 * Same-origin image proxy so the browser can read artwork pixels
 * (canvas color extraction is blocked for cross-origin images).
 * Only artwork hosts are allowed, so this can't be used as an open proxy:
 * - every redirect hop is re-checked against the allowlist
 * - only raster image types pass (no SVG, which could carry scripts)
 * - the body is read with a hard size cap
 */
const ALLOWED_HOSTS = [".googleusercontent.com", ".ytimg.com", ".ggpht.com", ".mzstatic.com"];
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;

const isAllowed = (u: URL) => u.protocol === "https:" && ALLOWED_HOSTS.some((h) => u.hostname.endsWith(h));

/** Fetch, following redirects by hand so each hop stays on an allowed host. */
async function fetchAllowed(start: URL): Promise<Response | "forbidden" | null> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (!res) return null;
    const location = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!location) return res;
    let next: URL;
    try {
      next = new URL(location, url);
    } catch {
      return null;
    }
    if (!isAllowed(next)) return "forbidden";
    url = next;
  }
  return null; // too many redirects
}

/** Read the body, giving up as soon as it passes `max` bytes. */
async function readCapped(res: Response, max: number): Promise<Uint8Array<ArrayBuffer> | null> {
  if (Number(res.headers.get("content-length") ?? 0) > max) return null;
  if (!res.body) return null;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url");
  let target: URL;
  try {
    target = new URL(raw ?? "");
  } catch {
    return new Response("Bad url", { status: 400 });
  }
  if (!isAllowed(target)) return new Response("Host not allowed", { status: 403 });

  const res = await fetchAllowed(target);
  if (res === "forbidden") return new Response("Host not allowed", { status: 403 });
  const type = (res?.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!res?.ok || !ALLOWED_TYPES.includes(type)) return new Response("Not found", { status: 404 });

  const body = await readCapped(res, MAX_BYTES);
  if (!body) return new Response("Too large", { status: 413 });

  return new Response(body, {
    headers: {
      "Content-Type": type,
      "X-Content-Type-Options": "nosniff",
      // even if a file slipped through, it can't run scripts or load anything
      "Content-Security-Policy": "default-src 'none'; sandbox; frame-ancestors 'none'", // also set in next.config.ts
      "Cache-Control": "public, max-age=86400, s-maxage=604800",
    },
  });
}
