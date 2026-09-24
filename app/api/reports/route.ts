import { currentUser, runtime, sameOrigin } from "../../lib/auth";
import { ensureAdminTables } from "../../lib/admin";

const reasons = new Set(["垃圾广告", "色情或暴力内容", "抄袭或侵权", "欺诈或虚假信息", "其他问题"]);

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const user = await currentUser(request), db = runtime().DB;
  if (!user) return Response.json({ error: "请先登录后举报" }, { status: 401 });
  if (!db) return Response.json({ error: "数据库暂不可用" }, { status: 503 });
  const body = await request.json() as { targetType?: string; targetId?: string | number; reason?: string; detail?: string };
  const targetId = String(body.targetId || "").trim(), reason = String(body.reason || "").trim();
  if (body.targetType !== "creation" || !targetId || !reasons.has(reason)) return Response.json({ error: "举报信息不完整" }, { status: 400 });
  if (body.detail && String(body.detail).length > 500) return Response.json({ error: "补充说明不能超过 500 个字" }, { status: 400 });
  await ensureAdminTables(db);
  const product = await db.prepare("SELECT id,visibility FROM creations WHERE id=? AND visibility='published'").bind(Number(targetId)).first<{ id:number; visibility:string }>();
  if (!product) return Response.json({ error: "产品不存在或已经下架" }, { status: 404 });
  const duplicate = await db.prepare("SELECT id FROM site_reports WHERE reporter_id=? AND target_type=? AND target_id=? AND status='pending'").bind(user.id, "creation", targetId).first();
  if (duplicate) return Response.json({ error: "你已经举报过这个产品" }, { status: 409 });
  await db.batch([
    db.prepare("INSERT INTO site_reports(reporter_id,target_type,target_id,reason,detail) VALUES(?,?,?,?,?)").bind(user.id, "creation", targetId, reason, String(body.detail || "").trim()),
    db.prepare("INSERT OR REPLACE INTO admin_hidden_creations(creation_id,previous_visibility,hidden_by,hidden_at) VALUES(?,?,?,CURRENT_TIMESTAMP)").bind(product.id, product.visibility, "report:" + user.id),
    db.prepare("UPDATE creations SET visibility='admin_hidden',updated_at=CURRENT_TIMESTAMP WHERE id=? AND visibility='published'").bind(product.id),
  ]);
  return Response.json({ ok: true, message: "举报已提交，产品已暂时下架等待审核" });
}
