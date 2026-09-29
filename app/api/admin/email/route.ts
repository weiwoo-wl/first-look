import { currentAdmin, logAdminAction } from "../../../lib/admin";
import { normalizeEmail, runtime, sameOrigin } from "../../../lib/auth";
import { sendAdminEmail } from "../../../lib/smtp";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const admin = await currentAdmin(request);
  if (!admin) return Response.json({ error: "只有管理员可以发送邮件" }, { status: 403 });
  const { DB: db, SMTP_PASSWORD: password } = runtime();
  if (!db || !password) return Response.json({ error: "邮件服务暂不可用" }, { status: 503 });
  let input: { recipientIds?: unknown; subject?: unknown; body?: unknown; batchId?: unknown };
  try { input = await request.json(); } catch { return Response.json({ error: "邮件信息不正确" }, { status: 400 }); }
  const subject = typeof input.subject === "string" ? input.subject.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  const batchId = typeof input.batchId === "string" ? input.batchId : "";
  if (!subject || subject.length > 160 || !body || body.length > 10000 || !/^[a-zA-Z0-9-]{16,64}$/.test(batchId)) return Response.json({ error: "请填写主题和正文，主题最多160字，正文最多10000字" }, { status: 400 });
  if (!Array.isArray(input.recipientIds) || !input.recipientIds.length || input.recipientIds.length > 5 || input.recipientIds.some(id => typeof id !== "string" || id.length > 100)) return Response.json({ error: "每批请选择1至5位用户" }, { status: 400 });
  const ids = [...new Set(input.recipientIds as string[])];
  await db.prepare("CREATE TABLE IF NOT EXISTS admin_mail_deliveries(batch_id TEXT NOT NULL,user_id TEXT NOT NULL,admin_id TEXT NOT NULL,email TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(batch_id,user_id))").run();
  const previous = await db.prepare("SELECT admin_id,subject,body FROM admin_mail_deliveries WHERE batch_id=? LIMIT 1").bind(batchId).first<{ admin_id: string; subject: string; body: string }>();
  if (previous && (previous.admin_id !== admin.id || previous.subject !== subject || previous.body !== body)) return Response.json({ error: "这批邮件的内容已变更，请重新发送" }, { status: 409 });
  const results: { userId: string; email: string; status: string }[] = [];
  for (const userId of ids) {
    const user = await db.prepare("SELECT email,disabled_at FROM users WHERE id=?").bind(userId).first<{ email: string; disabled_at: string | null }>();
    const email = user && normalizeEmail(user.email);
    if (!user || user.disabled_at || !email) { results.push({ userId, email: user?.email || "", status: "unavailable" }); continue; }
    const claimed = await db.prepare("INSERT OR IGNORE INTO admin_mail_deliveries(batch_id,user_id,admin_id,email,subject,body,status) VALUES(?,?,?,?,?,?,'sending')").bind(batchId,userId,admin.id,email,subject,body).run();
    if (!claimed.meta.changes) {
      const saved = await db.prepare("SELECT status FROM admin_mail_deliveries WHERE batch_id=? AND user_id=?").bind(batchId,userId).first<{ status: string }>();
      results.push({ userId, email, status: saved?.status || "sending" }); continue;
    }
    let status = "sent";
    try { await sendAdminEmail(email,subject,body,password); }
    catch (error) { console.error("[admin] manual email failed", error); status = "failed"; }
    await db.prepare("UPDATE admin_mail_deliveries SET status=?,updated_at=CURRENT_TIMESTAMP WHERE batch_id=? AND user_id=?").bind(status,batchId,userId).run();
    results.push({ userId, email, status });
  }
  await logAdminAction(db,admin.id,"send_email","mail",batchId,`${subject}：成功 ${results.filter(r=>r.status==="sent").length}，失败 ${results.filter(r=>r.status!=="sent").length}`);
  return Response.json({ results }, { headers: { "Cache-Control": "no-store" } });
}
