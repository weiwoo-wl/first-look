import { currentUser, runtime, sameOrigin } from "../../lib/auth";
import { ensureNotificationTable } from "../../lib/notifications";

export async function GET(request: Request) {
  const user = await currentUser(request), db = runtime().DB;
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  if (!db) return Response.json({ error: "通知暂不可用" }, { status: 503 });
  await ensureNotificationTable(db);
  const [rows, count] = await Promise.all([
    db.prepare("SELECT id,type,title,summary,url,created_at,read_at FROM user_notifications WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 100").bind(user.id).all(),
    db.prepare("SELECT COUNT(*) AS total FROM user_notifications WHERE user_id=? AND read_at IS NULL").bind(user.id).first<{ total: number }>(),
  ]);
  return Response.json({ notifications: rows.results, unread: Number(count?.total || 0) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const user = await currentUser(request), db = runtime().DB;
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  if (!db) return Response.json({ error: "通知暂不可用" }, { status: 503 });
  let body: { id?: number; all?: boolean };
  try { body = await request.json() as { id?: number; all?: boolean }; } catch { return Response.json({ error: "操作信息无效" }, { status: 400 }); }
  await ensureNotificationTable(db);
  if (body.all === true) {
    await db.prepare("UPDATE user_notifications SET read_at=CURRENT_TIMESTAMP WHERE user_id=? AND read_at IS NULL").bind(user.id).run();
  } else if (Number.isSafeInteger(body.id) && Number(body.id) > 0) {
    await db.prepare("UPDATE user_notifications SET read_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND read_at IS NULL").bind(body.id,user.id).run();
  } else return Response.json({ error: "请选择要标记的通知" }, { status: 400 });
  const count = await db.prepare("SELECT COUNT(*) AS total FROM user_notifications WHERE user_id=? AND read_at IS NULL").bind(user.id).first<{ total: number }>();
  return Response.json({ ok: true, unread: Number(count?.total || 0) });
}
