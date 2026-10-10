const encoder = new TextEncoder();

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function signature(secret: string, value: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function safeKey(url: URL) {
  const key = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  return key && !key.includes("..") && /^videos\/[0-9]{4}\/[0-9]{2}\/[0-9]{2}\/[0-9a-f-]{36}\/[a-zA-Z0-9_./-]+$/.test(key) ? key : null;
}

function contentType(key: string) {
  if (key.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (key.endsWith(".ts")) return "video/mp2t";
  if (key.endsWith(".m4s") || key.endsWith(".mp4")) return "video/mp4";
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

function cacheControl(key: string) {
  if (key.endsWith(".m3u8")) return "public, max-age=300, s-maxage=300";
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "public, max-age=2592000, s-maxage=2592000, immutable";
  return "public, max-age=31536000, s-maxage=31536000, immutable";
}

function cacheKey(url: URL, key: string) {
  const pathname = key.split("/").map(encodeURIComponent).join("/");
  return new Request(`${url.origin}/${pathname}`, { method: "GET" });
}

const allowedOrigins = new Set(["https://5k.ag", "https://www.5k.ag", "https://admin.5k.ag", "https://ikumep.cn", "https://wflhc.cn", "https://www.wflhc.cn", "https://5knews.wflhc.cn"]);

function cors(request: Request, headers = new Headers()) {
  const origin = request.headers.get("Origin");
  if (origin && allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, PUT, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Range");
  headers.set("Access-Control-Expose-Headers", "ETag, Content-Length, Content-Range, Accept-Ranges, X-Media-Cache");
  return headers;
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      const origin = request.headers.get("Origin");
      if (!origin || !allowedOrigins.has(origin)) return new Response("Forbidden", { status: 403 });
      return new Response(null, { status: 204, headers: cors(request) });
    }
    const key = safeKey(url), expires = Number(url.searchParams.get("expires")), provided = url.searchParams.get("signature") || "";
    if (!key || !Number.isFinite(expires) || expires < Date.now() || expires > Date.now() + 2 * 60 * 60 * 1000)
      return new Response("Forbidden", { status: 403 });
    const length = request.method === "PUT" ? Number(request.headers.get("content-length") || 0) : 0,
      type = request.method === "PUT" ? (request.headers.get("content-type") || contentType(key)) : "",
      message = [request.method, key, expires, length, type].join("\n"),
      expected = await signature(env.UPLOAD_SECRET, message);
    if (provided.length !== expected.length || !crypto.subtle.timingSafeEqual(encoder.encode(provided), encoder.encode(expected)))
      return new Response("Forbidden", { status: 403 });

    if (request.method === "PUT") {
      if (!request.body || length < 1 || length > 32 * 1024 * 1024) return new Response("Invalid size", { status: 413 });
      const object = await env.MEDIA.put(key, request.body, { httpMetadata: { contentType: type } });
      ctx.waitUntil(caches.default.delete(cacheKey(url, key)));
      return new Response(JSON.stringify({ key, etag: object.httpEtag }), { headers: cors(request, new Headers({ "Content-Type": "application/json", ETag: object.httpEtag })) });
    }
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method Not Allowed", { status: 405 });
    const range = request.headers.get("range");
    const sharedCacheKey = cacheKey(url, key);
    if (!range) {
      const cached = await caches.default.match(sharedCacheKey);
      if (cached) {
        const headers = cors(request, new Headers(cached.headers));
        headers.set("X-Media-Cache", "HIT");
        return new Response(request.method === "HEAD" ? null : cached.body, {
          status: cached.status,
          headers,
        });
      }
    }
    const object = await env.MEDIA.get(key, range ? { range: request.headers } : undefined);
    if (!object) return new Response("Not Found", { status: 404 });
    const headers = cors(request, new Headers({ ETag: object.httpEtag, "Content-Type": object.httpMetadata?.contentType || contentType(key), "Accept-Ranges": "bytes" }));
    object.writeHttpMetadata(headers);
    if ("range" in object && object.range) {
      const r = object.range;
      if ("offset" in r && typeof r.offset === "number" && typeof r.length === "number")
        headers.set("Content-Range", `bytes ${r.offset}-${r.offset + r.length - 1}/${object.size}`);
    }
    headers.set("Content-Length", String("range" in object && object.range && "length" in object.range ? object.range.length : object.size));
    headers.set("Cache-Control", cacheControl(key));
    headers.set("X-Media-Cache", range ? "BYPASS" : "MISS");
    const response = new Response(request.method === "HEAD" ? null : object.body, { status: range ? 206 : 200, headers });
    if (!range && request.method === "GET") ctx.waitUntil(caches.default.put(sharedCacheKey, response.clone()));
    return response;
  }
} satisfies ExportedHandler<Env>;
