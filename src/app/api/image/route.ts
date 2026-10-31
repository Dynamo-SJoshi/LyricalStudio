/**
 * Same-origin image proxy so the browser can read artwork pixels
 * (canvas color extraction is blocked for cross-origin images).
 * Only artwork hosts are allowed, so this can't be used as an open proxy.
 */
const ALLOWED_HOSTS = [".googleusercontent.com", ".ytimg.com", ".ggpht.com", ".mzstatic.com"];
const MAX_BYTES = 2 * 1024 * 1024;

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url");
  let target: URL;
  try {
    target = new URL(raw ?? "");
  } catch {
    return new Response("Bad url", { status: 400 });
  }
  if (target.protocol !== "https:" || !ALLOWED_HOSTS.some((h) => target.hostname.endsWith(h))) {
    return new Response("Host not allowed", { status: 403 });
  }

  const res = await fetch(target, { signal: AbortSignal.timeout(8000) }).catch(() => null);
  const type = res?.headers.get("content-type") ?? "";
  if (!res?.ok || !type.startsWith("image/")) return new Response("Not found", { status: 404 });

  const body = await res.arrayBuffer();
  if (body.byteLength > MAX_BYTES) return new Response("Too large", { status: 413 });

  return new Response(body, {
    headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400, s-maxage=604800" },
  });
}
