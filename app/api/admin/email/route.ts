import { currentAdmin, logAdminAction } from "../../../lib/admin";
import { normalizeEmail, runtime, sameOrigin } from "../../../lib/auth";
import { sendAdminEmail } from "../../../lib/smtp";

export async function GET(request: Request) {
  const admin = await currentAdmin(request);
  if (!admin) return Response.json({ error: "只有管理员可以查看发送记录" }, { status: 403 });
  const { DB: db } = runtime();
  if (!db) return Response.json({ error: "邮件记录暂不可用" }, { status: 503 });
  const page = Number(new URL(request.url).searchParams.get("page") || "1");
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) return Response.json({ error: "页码无效" }, { status: 400 });
  const exists = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='admin_mail_deliveries'").first();
  if (!exists) return Response.json({ records: [], hasMore: false }, { headers: { "Cache-Control": "no-store" } });
  const batches = await db.prepare("SELECT batch_id,MIN(created_at) AS created_at FROM admin_mail_deliveries GROUP BY batch_id ORDER BY created_at DESC,batch_id DESC LIMIT 21 OFFSET ?").bind((page - 1) * 20).all<{ batch_id: string; created_at: string }>();
  const records = [];
  for (const batch of batches.results.slice(0, 20)) {
    const rows = await db.prepare("SELECT email,status,subject,body FROM admin_mail_deliveries WHERE batch_id=? ORDER BY email").bind(batch.batch_id).all<{ email: string; status: string; subject: string; body: string }>();
    const first = rows.results[0];
    if (first) records.push({ batchId: batch.batch_id, createdAt: batch.created_at, subject: first.subject, body: first.body, recipients: rows.results.map(({ email, status }) => ({ email, status })) });
  }
  return Response.json({ records, hasMore: batches.results.length > 20 }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const admin = await currentAdmin(request);
  if (!admin) return Response.json({ error: "只有管理员可以发送邮件" }, { status: 403 });
  const { DB: db, SERVER_SMTP_PASSWORD: password } = runtime();
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
