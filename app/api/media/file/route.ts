import { currentUser, runtime } from "../../../lib/auth";

function notFound() {
  return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
}

function requestedRange(value: string | null, size: number) {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || (!match[1] && !match[2])) return undefined;
  if (!match[1]) {
    const length = Math.min(Number(match[2]), size);
    return Number.isSafeInteger(length) && length > 0 ? { offset: size - length, length } : undefined;
  }
  const start = Number(match[1]), end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return undefined;
  return { offset: start, length: Math.min(end, size - 1) - start + 1 };
}

export async function GET(request: Request) {
  try {
    const { DB: db, MEDIA: bucket } = runtime(), key = new URL(request.url).searchParams.get("key");
    if (!db || !bucket || !key) return notFound();
    const segments = key.split("/");
    if (segments.length !== 5 || segments[0] !== "users" || !segments[1] || segments[2] !== "creations" || !/^\d+$/.test(segments[3]) || !segments[4]) return notFound();
    const creationId = Number(segments[3]);
    const creation = await db.prepare("SELECT creator_id,visibility FROM creations WHERE id=?").bind(creationId).first<{ creator_id:string; visibility:string }>();
    if (!creation || String(creation.creator_id) !== segments[1]) return notFound();
    const media = await db.prepare("SELECT 1 AS found FROM creation_media WHERE creation_id=? AND object_key=? LIMIT 1").bind(creationId,key).first();
    if (!media) return notFound();
    if (creation.visibility !== "published") {
      const user = await currentUser(request);
      if (!user || String(user.id) !== String(creation.creator_id)) return notFound();
    }

    const head = await bucket.head(key);
    if (!head) return notFound();
    const range = requestedRange(request.headers.get("Range"), head.size);
    if (range === undefined) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${head.size}`, "Accept-Ranges": "bytes" } });
    const object = await bucket.get(key, range ? { range } : undefined);
    if (!object) return notFound();

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Content-Type", head.httpMetadata?.contentType || "application/octet-stream");
    headers.set("ETag", object.httpEtag);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", creation.visibility === "published" ? "public, max-age=3600" : "private, no-store");
    if (range) {
      headers.set("Content-Range", `bytes ${range.offset}-${range.offset + range.length - 1}/${head.size}`);
      headers.set("Content-Length", String(range.length));
      return new Response(object.body, { status: 206, headers });
    }
    headers.set("Content-Length", String(head.size));
    return new Response(object.body, { headers });
  } catch (error) {
    console.error("[media/file]", error);
    return new Response(null, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
