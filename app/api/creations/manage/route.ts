import { currentUser, runtime, sameOrigin } from "../../../lib/auth";
import { ensureCreationTables, recordCreationEvent } from "../../../lib/creations";

function mediaKeys(rows: { media_json?: unknown }[]) {
  const keys = new Set<string>();
  for (const row of rows) {
    try {
      const media = JSON.parse(String(row.media_json || "[]")) as { object_key?: string }[];
      for (const item of media) if (item.object_key?.startsWith("users/")) keys.add(item.object_key);
    } catch {}
  }
  return keys;
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const user = await currentUser(request), { DB: db, MEDIA: bucket } = runtime();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  if (!db) return Response.json({ error: "数据库暂不可用" }, { status: 503 });
  await ensureCreationTables(db);
  const body = await request.json() as { creationId?: number; action?: "unpublish" | "republish" | "publicize" | "delete" };
  if (!body.creationId || !["unpublish", "republish", "publicize", "delete"].includes(body.action || "")) return Response.json({ error: "操作信息不正确" }, { status: 400 });
  const product = await db.prepare("SELECT id,visibility FROM creations WHERE id=? AND creator_id=?").bind(body.creationId, user.id).first<{ id:number; visibility:string }>();
  if (!product) return Response.json({ error: "找不到这个产品" }, { status: 404 });

  if (body.action === "delete") {
    const currentMedia = await db.prepare("SELECT object_key FROM creation_media WHERE creation_id=?").bind(body.creationId).all<{ object_key:string }>();
    const versions = await db.prepare("SELECT media_json FROM creation_versions WHERE creation_id=?").bind(body.creationId).all<{ media_json:string }>();
    const keys = mediaKeys(versions.results);
    for (const item of currentMedia.results) if (item.object_key?.startsWith("users/")) keys.add(item.object_key);
    await db.batch([
      db.prepare("DELETE FROM creation_likes WHERE creation_id=?").bind(body.creationId),
      db.prepare("DELETE FROM creation_events WHERE creation_id=?").bind(body.creationId),
      db.prepare("DELETE FROM creation_versions WHERE creation_id=?").bind(body.creationId),
      db.prepare("DELETE FROM creation_media WHERE creation_id=?").bind(body.creationId),
      db.prepare("DELETE FROM creations WHERE id=? AND creator_id=?").bind(body.creationId, user.id),
    ]);
    if (bucket && keys.size) {
      try { await bucket.delete([...keys]); }
      catch (error) { console.error("[creations/manage] deleted product but media cleanup failed", { creationId: body.creationId, error: String(error) }); }
    }
    return Response.json({ ok: true, deleted: true });
  }

  if (["draft", "private_pending"].includes(product.visibility)) return Response.json({ error: "作品还没有完成发布" }, { status: 409 });
  if (body.action === "publicize" && product.visibility !== "private") return Response.json({ error: "只有仅自己可见的作品可以公开上架" }, { status: 409 });
  if (body.action === "unpublish" && product.visibility === "private") return Response.json({ error: "仅自己可见的作品尚未公开上架" }, { status: 409 });
  const visibility = body.action === "unpublish" ? "unpublished" : "published";
  if (product.visibility === visibility) return Response.json({ ok: true, visibility });
  await db.prepare("UPDATE creations SET visibility=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND creator_id=?").bind(visibility, body.creationId, user.id).run();
  const eventType = body.action === "publicize" ? "publicized" : visibility === "published" ? "republished" : "unpublished";
  const detail = body.action === "publicize" ? "产品公开上架" : visibility === "published" ? "产品重新上架" : "产品下架";
  await recordCreationEvent(db, body.creationId, user.id, eventType, detail);
  return Response.json({ ok: true, visibility });
}
