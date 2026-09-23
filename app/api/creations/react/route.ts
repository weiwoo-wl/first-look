import { currentUser, runtime, sameOrigin } from "../../../lib/auth";
import { ensureCreationTables, recordCreationEvent } from "../../../lib/creations";

export async function GET(request: Request) {
  const user = await currentUser(request), db = runtime().DB, creationId = Number(new URL(request.url).searchParams.get("creationId"));
  if (!db || !creationId) return Response.json({ count: 0, liked: false });
  await ensureCreationTables(db);
  const product = await db.prepare("SELECT id FROM creations WHERE id=? AND visibility='published'").bind(creationId).first();
  if (!product) return Response.json({ error: "产品不存在" }, { status: 404 });
  const count = await db.prepare("SELECT COUNT(*) AS total FROM creation_likes WHERE creation_id=?").bind(creationId).first<{total:number}>();
  const liked = user ? await db.prepare("SELECT id FROM creation_likes WHERE creation_id=? AND user_id=?").bind(creationId,user.id).first() : null;
  return Response.json({ count: Number(count?.total || 0), liked: Boolean(liked) });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const user = await currentUser(request), db = runtime().DB;
  if (!user) return Response.json({ error: "请先登录后再点赞" }, { status: 401 });
  if (!db) return Response.json({ error: "数据库暂不可用" }, { status: 503 });
  await ensureCreationTables(db);
  const body = await request.json() as { creationId?: number };
  if (!body.creationId) return Response.json({ error: "产品不存在" }, { status: 400 });
  const product = await db.prepare("SELECT id FROM creations WHERE id=? AND visibility='published'").bind(body.creationId).first();
  if (!product) return Response.json({ error: "产品不存在" }, { status: 404 });
  const existing = await db.prepare("SELECT id FROM creation_likes WHERE creation_id=? AND user_id=?").bind(body.creationId,user.id).first<{id:number}>();
  if (existing) await db.prepare("DELETE FROM creation_likes WHERE id=?").bind(existing.id).run();
  else await db.prepare("INSERT INTO creation_likes(creation_id,user_id) VALUES(?,?)").bind(body.creationId,user.id).run();
  const count = await db.prepare("SELECT COUNT(*) AS total FROM creation_likes WHERE creation_id=?").bind(body.creationId).first<{total:number}>();
  await recordCreationEvent(db,body.creationId,user.id,existing ? "unliked" : "liked",existing ? "取消喜欢" : "收到一个喜欢",Number(count?.total || 0));
  return Response.json({ count: Number(count?.total || 0), liked: !existing });
}
