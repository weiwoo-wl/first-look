import { currentUser, runtime, sameOrigin } from "../../../lib/auth";
import { createCreationVersion, ensureCreationTables, parseTags } from "../../../lib/creations";

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const user = await currentUser(request), db = runtime().DB;
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  if (!db) return Response.json({ error: "数据库暂不可用" }, { status: 503 });
  await ensureCreationTables(db);
  const body = await request.json() as { creationId?: number; title?: string; description?: string; type?: string; status?: string; story?: string; tags?: string; productUrl?: string; changeNote?: string };
  if (!body.creationId || !body.title?.trim() || !body.description?.trim() || !body.type?.trim()) return Response.json({ error: "名称、介绍和类型不能为空" }, { status: 400 });
  const product = await db.prepare("SELECT id,visibility FROM creations WHERE id=? AND creator_id=?").bind(body.creationId, user.id).first<{id:number;visibility:string}>();
  if (!product || product.visibility === "draft") return Response.json({ error: "找不到可编辑的已发布产品" }, { status: 404 });
  await db.prepare("UPDATE creations SET title=?,description=?,type=?,status=?,story=?,tags=?,product_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND creator_id=?")
    .bind(body.title.trim(), body.description.trim(), body.type.trim(), body.status?.trim() || "早期测试", body.story || "", parseTags(body.tags), body.productUrl?.trim() || "", body.creationId, user.id).run();
  const version = await createCreationVersion(db, body.creationId, user.id, body.changeNote?.trim() || "更新产品内容");
  return Response.json({ ok: true, version });
}
