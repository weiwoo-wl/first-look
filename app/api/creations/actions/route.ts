import { currentUser, runtime, sameOrigin } from "../../../lib/auth";
import { ensureCreationTables, recordCreationEvent } from "../../../lib/creations";

export async function GET(request: Request) {
  const db = runtime().DB, creationId = Number(new URL(request.url).searchParams.get("creationId"));
  if (!db || !creationId) return Response.json({ likes: 0, favorites: 0, shares: 0, views: 0, liked: false, favorited: false });
  await ensureCreationTables(db);
  if (!await db.prepare("SELECT id FROM creations WHERE id=? AND visibility='published'").bind(creationId).first()) return Response.json({ error: "产品不存在" }, { status: 404 });
  const user = await currentUser(request);
  const [likes, favorites, shares, views] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS total FROM creation_likes WHERE creation_id=?").bind(creationId).first<{ total: number }>(),
    db.prepare("SELECT COUNT(*) AS total FROM creation_favorites WHERE creation_id=?").bind(creationId).first<{ total: number }>(),
    db.prepare("SELECT COUNT(*) AS total FROM creation_shares WHERE creation_id=?").bind(creationId).first<{ total: number }>(),
    db.prepare("SELECT COUNT(*) AS total FROM creation_views WHERE creation_id=?").bind(creationId).first<{ total: number }>(),
  ]);
  const liked = user ? await db.prepare("SELECT id FROM creation_likes WHERE creation_id=? AND user_id=?").bind(creationId, user.id).first() : null;
  const favorited = user ? await db.prepare("SELECT id FROM creation_favorites WHERE creation_id=? AND user_id=?").bind(creationId, user.id).first() : null;
  return Response.json({ likes: Number(likes?.total || 0), favorites: Number(favorites?.total || 0), shares: Number(shares?.total || 0), views: Number(views?.total || 0), liked: Boolean(liked), favorited: Boolean(favorited) });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const db = runtime().DB;
  if (!db) return Response.json({ error: "数据库暂不可用" }, { status: 503 });
  const body = await request.json() as { creationId?: number; action?: "favorite" | "share" | "view" }, id = Number(body.creationId);
  if (!id || !body.action) return Response.json({ error: "操作信息不正确" }, { status: 400 });
  await ensureCreationTables(db);
  const product = await db.prepare("SELECT id,slug FROM creations WHERE id=? AND visibility='published'").bind(id).first<{ id: number; slug: string }>();
  if (!product) return Response.json({ error: "产品不存在" }, { status: 404 });
  if (body.action === "share") { await db.prepare("INSERT INTO creation_shares(creation_id,source) VALUES(?,?)").bind(id, "copy-link").run(); return Response.json({ ok: true, url: `/work/${encodeURIComponent(product.slug)}` }); }
  if (body.action === "view") {
    const user = await currentUser(request), cookie = request.headers.get("Cookie")?.match(/firstlook_viewer=([^;]+)/)?.[1], visitorKey = user ? `user:${user.id}` : `visitor:${cookie || crypto.randomUUID()}`, bucket = String(Math.floor(Date.now() / 1800000));
    await db.prepare("INSERT OR IGNORE INTO creation_views(creation_id,visitor_key,bucket) VALUES(?,?,?)").bind(id, visitorKey, bucket).run();
    const views = await db.prepare("SELECT COUNT(*) AS total FROM creation_views WHERE creation_id=?").bind(id).first<{ total: number }>(), headers = new Headers({ "Content-Type": "application/json" });
    if (!cookie && !user) headers.set("Set-Cookie", `firstlook_viewer=${visitorKey.slice(8)}; Max-Age=31536000; Path=/; SameSite=Lax`);
    return new Response(JSON.stringify({ ok: true, views: Number(views?.total || 0) }), { headers });
  }
  const user = await currentUser(request);
  if (!user) return Response.json({ error: "请先登录后再收藏" }, { status: 401 });
  const existing = await db.prepare("SELECT id FROM creation_favorites WHERE creation_id=? AND user_id=?").bind(id, user.id).first<{ id: number }>();
  if (existing) await db.prepare("DELETE FROM creation_favorites WHERE id=?").bind(existing.id).run(); else await db.prepare("INSERT INTO creation_favorites(creation_id,user_id) VALUES(?,?)").bind(id, user.id).run();
  const favorites = await db.prepare("SELECT COUNT(*) AS total FROM creation_favorites WHERE creation_id=?").bind(id).first<{ total: number }>();
  await recordCreationEvent(db, id, user.id, existing ? "unfavorited" : "favorited", existing ? "取消收藏" : "收藏了产品");
  return Response.json({ ok: true, favorited: !existing, favorites: Number(favorites?.total || 0) });
}
