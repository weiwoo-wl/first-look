import { currentUser, runtime, sameOrigin } from "../../../lib/auth";
import { adminRoleForUser } from "../../../lib/admin";
import { ensureCreationTables, recordCreationEvent } from "../../../lib/creations";
import { ensureCreatorProfileTables } from "../../../lib/creator-profile";
import { readVisitorId, visitorJson } from "../../../lib/visitor-identity";

export async function GET(request: Request) {
  const db = runtime().DB, creationId = Number(new URL(request.url).searchParams.get("creationId"));
  if (!db || !creationId) return Response.json({ likes: 0, favorites: 0, shares: 0, views: 0, liked: false, favorited: false });
  await ensureCreationTables(db);
  await ensureCreatorProfileTables(db);
  const product = await db.prepare("SELECT c.id,c.slug,c.creator_id,CASE WHEN u.contact_enabled=1 THEN u.email ELSE NULL END AS contact_email FROM creations c LEFT JOIN users u ON u.id=c.creator_id WHERE c.id=? AND c.visibility='published'").bind(creationId).first<{ id: number; slug: string; creator_id: string; contact_email: string | null }>();
  if (!product) return Response.json({ error: "产品不存在" }, { status: 404 });
  const user = await currentUser(request);
  const selfInteractionLimited = Boolean(user && user.id === product.creator_id && await adminRoleForUser(db, user.id) !== "owner");
  const [likes, favorites, shares, views] = await Promise.all([
    db.prepare("SELECT MAX((SELECT COUNT(*) FROM creation_likes WHERE creation_id=?),(SELECT COUNT(*) FROM creation_events WHERE creation_id=? AND event_type='liked')) AS total").bind(creationId, creationId).first<{ total: number }>(),
    db.prepare("SELECT MAX((SELECT COUNT(*) FROM creation_favorites WHERE creation_id=?),(SELECT COUNT(*) FROM creation_events WHERE creation_id=? AND event_type='favorited')) AS total").bind(creationId, creationId).first<{ total: number }>(),
    db.prepare("SELECT COUNT(*) AS total FROM creation_shares WHERE creation_id=?").bind(creationId).first<{ total: number }>(),
    db.prepare("SELECT COUNT(*) AS total FROM creation_views WHERE creation_id=?").bind(creationId).first<{ total: number }>(),
  ]);
  const identity = user?.id || (readVisitorId(request) ? `visitor:${readVisitorId(request)}` : null);
  const liked = identity ? await db.prepare("SELECT id FROM creation_likes WHERE creation_id=? AND user_id=?").bind(creationId, identity).first() : null;
  const favorited = identity ? await db.prepare("SELECT id FROM creation_favorites WHERE creation_id=? AND user_id=?").bind(creationId, identity).first() : null;
  const [priorLike, priorFavorite, ownShare, ownView] = selfInteractionLimited ? await Promise.all([
    db.prepare("SELECT id FROM creation_events WHERE creation_id=? AND actor_id=? AND event_type='liked' LIMIT 1").bind(creationId, user!.id).first(),
    db.prepare("SELECT id FROM creation_events WHERE creation_id=? AND actor_id=? AND event_type='favorited' LIMIT 1").bind(creationId, user!.id).first(),
    db.prepare("SELECT id FROM creation_shares WHERE creation_id=? AND user_id=? LIMIT 1").bind(creationId, user!.id).first(),
    db.prepare("SELECT id FROM creation_views WHERE creation_id=? AND visitor_key=? LIMIT 1").bind(creationId, `user:${user!.id}`).first(),
  ]) : [null, null, null, null];
  return Response.json({ likes: Number(likes?.total || 0), favorites: Number(favorites?.total || 0), shares: Number(shares?.total || 0), views: Number(views?.total || 0), liked: Boolean(liked), favorited: Boolean(favorited), selfInteractionLimited, selfLikeUsed: Boolean(liked || priorLike), selfFavoriteUsed: Boolean(favorited || priorFavorite), selfShareUsed: Boolean(ownShare), selfViewUsed: Boolean(ownView), contactEmail: product.contact_email, slug: product.slug });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const db = runtime().DB;
  if (!db) return Response.json({ error: "数据库暂不可用" }, { status: 503 });
  const body = await request.json() as { creationId?: number; action?: "favorite" | "share" | "view"; source?: "copy-link" | "native-share" }, id = Number(body.creationId);
  if (!id || !body.action) return Response.json({ error: "操作信息不正确" }, { status: 400 });
  await ensureCreationTables(db);
  const product = await db.prepare("SELECT id,slug,creator_id FROM creations WHERE id=? AND visibility='published'").bind(id).first<{ id: number; slug: string; creator_id: string }>();
  if (!product) return Response.json({ error: "产品不存在" }, { status: 404 });
  const user = await currentUser(request), selfBlocked = Boolean(user && user.id === product.creator_id && await adminRoleForUser(db, user.id) !== "owner");
  if (body.action === "share") { const source = body.source === "native-share" ? "native-share" : "copy-link"; const prior = selfBlocked ? await db.prepare("SELECT id FROM creation_shares WHERE creation_id=? AND user_id=? LIMIT 1").bind(id, user!.id).first() : null; const counted = !prior; if (counted) await db.prepare("INSERT INTO creation_shares(creation_id,user_id,source) VALUES(?,?,?)").bind(id, user?.id || null, source).run(); const shares = await db.prepare("SELECT COUNT(*) AS total FROM creation_shares WHERE creation_id=?").bind(id).first<{ total: number }>(); return Response.json({ ok: true, counted, shares: Number(shares?.total || 0), url: `/work/${encodeURIComponent(product.slug)}` }); }
  if (body.action === "view") {
    const visitorKey = selfBlocked ? `user:${user!.id}` : crypto.randomUUID(), bucket = String(Math.floor(Date.now() / 1800000));
    const prior = selfBlocked ? await db.prepare("SELECT id FROM creation_views WHERE creation_id=? AND visitor_key=? LIMIT 1").bind(id, visitorKey).first() : null;
    if (!prior) await db.prepare("INSERT INTO creation_views(creation_id,visitor_key,bucket) VALUES(?,?,?)").bind(id, visitorKey, bucket).run();
    const views = await db.prepare("SELECT COUNT(*) AS total FROM creation_views WHERE creation_id=?").bind(id).first<{ total: number }>(), headers = new Headers({ "Content-Type": "application/json" });
    return new Response(JSON.stringify({ ok: true, views: Number(views?.total || 0) }), { headers });
  }
  const cookieId = user ? null : readVisitorId(request), visitorId = cookieId || crypto.randomUUID(), identity = user?.id || `visitor:${visitorId}`;
  const existing = await db.prepare("SELECT id FROM creation_favorites WHERE creation_id=? AND user_id=?").bind(id, identity).first<{ id: number }>();
  if (selfBlocked) {
    const priorFavorite = await db.prepare("SELECT id FROM creation_events WHERE creation_id=? AND actor_id=? AND event_type='favorited' LIMIT 1").bind(id, identity).first();
    if (existing || priorFavorite) {
      const favorites = await db.prepare("SELECT MAX((SELECT COUNT(*) FROM creation_favorites WHERE creation_id=?),(SELECT COUNT(*) FROM creation_events WHERE creation_id=? AND event_type='favorited')) AS total").bind(id, id).first<{ total: number }>();
      return Response.json({ ok: true, favorited: Boolean(existing), favorites: Number(favorites?.total || 0), limited: true });
    }
  }
  if (existing) await db.prepare("DELETE FROM creation_favorites WHERE id=?").bind(existing.id).run(); else await db.prepare("INSERT INTO creation_favorites(creation_id,user_id) VALUES(?,?)").bind(id, identity).run();
  const favorites = await db.prepare("SELECT MAX((SELECT COUNT(*) FROM creation_favorites WHERE creation_id=?),(SELECT COUNT(*) FROM creation_events WHERE creation_id=? AND event_type='favorited')) AS total").bind(id, id).first<{ total: number }>();
  await recordCreationEvent(db, id, identity, existing ? "unfavorited" : "favorited", existing ? "取消收藏" : "收藏了产品");
  const result = { ok: true, favorited: !existing, favorites: Number(favorites?.total || 0) };
  return user ? Response.json(result) : visitorJson(request, visitorId, result);
}
