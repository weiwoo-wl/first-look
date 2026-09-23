import { currentUser, runtime, sameOrigin } from "../../../lib/auth";
import { ensureCreationTables, recordCreationEvent } from "../../../lib/creations";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const user = await currentUser(request), db = runtime().DB;
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  if (!db) return Response.json({ error: "数据库暂不可用" }, { status: 503 });
  await ensureCreationTables(db);
  const body = await request.json() as { creationId?: number; action?: "unpublish" | "republish" };
  if (!body.creationId || !["unpublish", "republish"].includes(body.action || "")) return Response.json({ error: "操作信息不正确" }, { status: 400 });
  const product = await db.prepare("SELECT id,visibility FROM creations WHERE id=? AND creator_id=?").bind(body.creationId,user.id).first<{id:number;visibility:string}>();
  if (!product) return Response.json({ error: "找不到这个产品" }, { status: 404 });
  if (product.visibility === "draft") return Response.json({ error: "草稿还没有发布" }, { status: 409 });
  const visibility = body.action === "unpublish" ? "unpublished" : "published";
  if (product.visibility === visibility) return Response.json({ ok: true, visibility });
  await db.prepare("UPDATE creations SET visibility=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND creator_id=?").bind(visibility,body.creationId,user.id).run();
  await recordCreationEvent(db,body.creationId,user.id,visibility === "published" ? "republished" : "unpublished",visibility === "published" ? "产品重新上架" : "产品下架");
  return Response.json({ ok: true, visibility });
}
