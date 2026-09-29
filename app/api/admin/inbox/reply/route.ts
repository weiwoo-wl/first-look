import { currentAdmin, logAdminAction } from "../../../../lib/admin";
import { normalizeEmail, runtime, sameOrigin } from "../../../../lib/auth";
import { readInbox } from "../../../../lib/inbox";
import { sendInboxReply } from "../../../../lib/smtp";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const admin = await currentAdmin(request);
  if (!admin) return Response.json({ error: "只有管理员可以回复邮件" }, { status: 403 });
  const { DB: db, SERVER_SMTP_PASSWORD: password } = runtime();
  if (!db || !password) return Response.json({ error: "邮箱尚未配置完成" }, { status: 503 });
  let input: { id?: unknown; body?: unknown; batchId?: unknown };
  try { input = await request.json(); } catch { return Response.json({ error: "回复信息无效" }, { status: 400 }); }
  const id = typeof input.id === "string" ? input.id : "", body = typeof input.body === "string" ? input.body.trim() : "", batchId = typeof input.batchId === "string" ? input.batchId : "";
  if (!/^\d{1,10}:\d{1,10}$/.test(id) || !/^[a-zA-Z0-9-]{16,64}$/.test(batchId) || !body || body.length > 10000) return Response.json({ error: "请填写回复正文，最多10000字" }, { status: 400 });
  await db.prepare("CREATE TABLE IF NOT EXISTS admin_mail_deliveries(batch_id TEXT NOT NULL,user_id TEXT NOT NULL,admin_id TEXT NOT NULL,email TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(batch_id,user_id))").run();
  const userId = `inbox:${id}`;
  const previous = await db.prepare("SELECT user_id,admin_id,body,status FROM admin_mail_deliveries WHERE batch_id=? LIMIT 1").bind(batchId).first<{ user_id: string; admin_id: string; body: string; status: string }>();
  if (previous) {
    if (previous.user_id !== userId || previous.admin_id !== admin.id || previous.body !== body) return Response.json({ error: "这次回复的内容已变更，请重新发送" }, { status: 409 });
    return Response.json({ status: previous.status }, { headers: { "Cache-Control": "no-store" } });
  }
  let original;
  try { original = await readInbox(password, id); } catch { return Response.json({ error: "无法读取原邮件，请刷新后重试；尚未发送回复" }, { status: 502 }); }
  const to = normalizeEmail(original.replyTo);
  if (!to || to === "server@firstlooklab.cn") return Response.json({ error: "这封邮件没有可回复的外部地址" }, { status: 400 });
  const subject = `Re: ${original.subject.replace(/^Re:\s*/i, "").replace(/[\r\n]/g, " ")}`.slice(0, 160);
  const claimed = await db.prepare("INSERT OR IGNORE INTO admin_mail_deliveries(batch_id,user_id,admin_id,email,subject,body,status) VALUES(?,?,?,?,?,?,'sending')").bind(batchId, userId, admin.id, to, subject, body).run();
  if (!claimed.meta.changes) return Response.json({ status: "sending" }, { headers: { "Cache-Control": "no-store" } });
  let status = "sent";
  try { await sendInboxReply(to, subject, body, password, { messageId: original.messageId, references: original.references }); }
  catch { status = "failed"; }
  await db.prepare("UPDATE admin_mail_deliveries SET status=?,updated_at=CURRENT_TIMESTAMP WHERE batch_id=? AND user_id=?").bind(status, batchId, userId).run();
  await logAdminAction(db, admin.id, "reply_email", "mail", id, status === "sent" ? "回复已提交发送" : "回复发送失败");
  return Response.json({ status }, { headers: { "Cache-Control": "no-store" } });
}
