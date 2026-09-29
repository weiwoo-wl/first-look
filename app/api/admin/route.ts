import { ensureCreationTables } from "../../lib/creations";
import { engagementColumns } from "../../lib/engagement";
import { currentAdmin, ensureAdminTables, logAdminAction } from "../../lib/admin";
import { ensureWelcomeEmailTable, runtime, sameOrigin } from "../../lib/auth";
import { sendWelcomeEmail } from "../../lib/smtp";

type AdminAction = "hide_creation" | "restore_creation" | "disable_user" | "enable_user" | "grant_admin" | "revoke_admin" | "resolve_report" | "restore_report" | "backfill_welcome_emails";

export async function GET(request: Request) {
  const db = runtime().DB;
  if (!db) return Response.json({ error: "数据库暂不可用" }, { status: 503 });
  const admin = await currentAdmin(request);
  if (!admin) return Response.json({ error: "无权访问管理后台" }, { status: 403 });
  await ensureAdminTables(db);
  await ensureWelcomeEmailTable(db);
  await ensureCreationTables(db);
  const [counts, products, users, reports, actions] = await Promise.all([
    db.prepare("SELECT (SELECT COUNT(*) FROM users) users_total,(SELECT COUNT(*) FROM creations) products_total,(SELECT COUNT(*) FROM creations WHERE visibility='published') published_total,(SELECT COUNT(*) FROM site_reports WHERE status='pending') reports_pending,(SELECT COUNT(*) FROM users u WHERE NOT EXISTS(SELECT 1 FROM welcome_emails w WHERE w.user_id=u.id)) welcome_pending,(SELECT COUNT(*) FROM welcome_emails WHERE status='failed') welcome_failed").first(),
    db.prepare(`SELECT c.id,c.title,c.type,c.creator_name,c.visibility,c.created_at,c.updated_at,${engagementColumns()},CASE WHEN h.creation_id IS NULL THEN 0 ELSE 1 END AS admin_hidden FROM creations c LEFT JOIN admin_hidden_creations h ON h.creation_id=c.id ORDER BY COALESCE(c.updated_at,c.created_at) DESC LIMIT 200`).all(),
    db.prepare("SELECT u.id,u.email,u.display_name,u.created_at,u.disabled_at,a.role AS admin_role FROM users u LEFT JOIN site_admins a ON a.user_id=u.id ORDER BY u.created_at DESC LIMIT 200").all(),
    db.prepare("SELECT r.id,r.target_type,r.target_id,r.reason,r.status,r.created_at,u.display_name AS reporter_name FROM site_reports r LEFT JOIN users u ON u.id=r.reporter_id ORDER BY CASE WHEN r.status='pending' THEN 0 ELSE 1 END,r.created_at DESC LIMIT 100").all(),
    db.prepare("SELECT a.id,a.action,a.target_type,a.target_id,a.detail,a.created_at,u.display_name AS admin_name FROM admin_actions a LEFT JOIN users u ON u.id=a.admin_id ORDER BY a.created_at DESC LIMIT 20").all(),
  ]);
  return Response.json({ me: admin, counts, products: products.results, users: users.results, reports: reports.results, actions: actions.results }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const db = runtime().DB;
  if (!db) return Response.json({ error: "数据库暂不可用" }, { status: 503 });
  const admin = await currentAdmin(request);
  if (!admin) return Response.json({ error: "无权执行管理操作" }, { status: 403 });
  const body = await request.json() as { action?: AdminAction; targetId?: string | number };
  const action = body.action, targetId = String(body.targetId || "").trim();
  if (!action || (action !== "backfill_welcome_emails" && !targetId)) return Response.json({ error: "操作信息不完整" }, { status: 400 });
  await ensureAdminTables(db);
  await ensureWelcomeEmailTable(db);

  if (action === "backfill_welcome_emails") {
    if (admin.role !== "owner") return Response.json({ error: "只有所有者可以补发欢迎邮件" }, { status: 403 });
    const smtpPassword = runtime().SERVER_SMTP_PASSWORD;
    if (!smtpPassword) return Response.json({ error: "邮件服务尚未配置完成" }, { status: 503 });
    const batchId = crypto.randomUUID();
    await db.prepare("INSERT OR IGNORE INTO welcome_emails(user_id,status,batch_id) SELECT u.id,'sending',? FROM users u WHERE NOT EXISTS(SELECT 1 FROM welcome_emails w WHERE w.user_id=u.id) ORDER BY u.created_at ASC LIMIT 5").bind(batchId).run();
    const batch = await db.prepare("SELECT u.id,u.email FROM welcome_emails w JOIN users u ON u.id=w.user_id WHERE w.batch_id=? AND w.status='sending'").bind(batchId).all<{ id:string; email:string }>();
    let sent = 0, failed = 0;
    for (const recipient of batch.results) {
      try {
        await sendWelcomeEmail(recipient.email, smtpPassword);
        await db.prepare("UPDATE welcome_emails SET status='sent',batch_id=NULL,sent_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND batch_id=?").bind(recipient.id,batchId).run();
        sent++;
      } catch (error) {
        await db.prepare("UPDATE welcome_emails SET status='failed',batch_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND batch_id=?").bind(recipient.id,batchId).run();
        console.error("[admin] welcome backfill failed", error);
        failed++;
      }
    }
    const [pending, failures] = await Promise.all([
      db.prepare("SELECT COUNT(*) AS total FROM users u WHERE NOT EXISTS(SELECT 1 FROM welcome_emails w WHERE w.user_id=u.id)").first<{ total:number }>(),
      db.prepare("SELECT COUNT(*) AS total FROM welcome_emails WHERE status='failed'").first<{ total:number }>(),
    ]);
    await logAdminAction(db, admin.id, action, "user", "all", `成功 ${sent}，失败 ${failed}`);
    return Response.json({ ok:true, sent, failed, remaining:Number(pending?.total||0), totalFailed:Number(failures?.total||0) });
  }

  if (action === "hide_creation") {
    const product = await db.prepare("SELECT id,title,visibility FROM creations WHERE id=?").bind(Number(targetId)).first<{ id:number; title:string; visibility:string }>();
    if (!product) return Response.json({ error: "找不到这个产品" }, { status: 404 });
    if (["draft","private_pending","finalizing","deleting","admin_hidden"].includes(product.visibility)) return Response.json({ error: "这个产品当前不能隐藏" }, { status: 409 });
    await db.batch([
      db.prepare("INSERT OR REPLACE INTO admin_hidden_creations(creation_id,previous_visibility,hidden_by,hidden_at) VALUES(?,?,?,CURRENT_TIMESTAMP)").bind(product.id, product.visibility, admin.id),
      db.prepare("UPDATE creations SET visibility='admin_hidden',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(product.id),
    ]);
    await logAdminAction(db, admin.id, action, "creation", targetId, product.title);
  } else if (action === "restore_creation") {
    const hidden = await db.prepare("SELECT h.previous_visibility,c.title FROM admin_hidden_creations h JOIN creations c ON c.id=h.creation_id WHERE h.creation_id=?").bind(Number(targetId)).first<{ previous_visibility:string; title:string }>();
    if (!hidden) return Response.json({ error: "这个产品没有被后台隐藏" }, { status: 409 });
    await db.batch([
      db.prepare("UPDATE creations SET visibility=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND visibility='admin_hidden'").bind(hidden.previous_visibility, Number(targetId)),
      db.prepare("DELETE FROM admin_hidden_creations WHERE creation_id=?").bind(Number(targetId)),
    ]);
    await logAdminAction(db, admin.id, action, "creation", targetId, hidden.title);
  } else if (action === "disable_user" || action === "enable_user") {
    if (targetId === admin.id) return Response.json({ error: "不能对自己的账号执行这个操作" }, { status: 409 });
    const target = await db.prepare("SELECT id,email FROM users WHERE id=?").bind(targetId).first<{ id:string; email:string }>();
    if (!target) return Response.json({ error: "找不到这个用户" }, { status: 404 });
    if (action === "disable_user") {
      const role = await db.prepare("SELECT role FROM site_admins WHERE user_id=?").bind(targetId).first<{ role:string }>();
      if (role?.role === "owner") return Response.json({ error: "不能禁用所有者账号" }, { status: 409 });
      await db.batch([db.prepare("UPDATE users SET disabled_at=CURRENT_TIMESTAMP WHERE id=?").bind(targetId), db.prepare("DELETE FROM user_sessions WHERE user_id=?").bind(targetId)]);
    } else await db.prepare("UPDATE users SET disabled_at=NULL WHERE id=?").bind(targetId).run();
    await logAdminAction(db, admin.id, action, "user", targetId, target.email);
  } else if (action === "grant_admin" || action === "revoke_admin") {
    if (admin.role !== "owner") return Response.json({ error: "只有所有者可以设置管理员" }, { status: 403 });
    if (targetId === admin.id) return Response.json({ error: "不能修改自己的所有者身份" }, { status: 409 });
    const target = await db.prepare("SELECT id,email,disabled_at FROM users WHERE id=?").bind(targetId).first<{ id:string; email:string; disabled_at:string|null }>();
    if (!target) return Response.json({ error: "找不到这个用户" }, { status: 404 });
    if (target.disabled_at) return Response.json({ error: "请先恢复这个用户" }, { status: 409 });
    if (action === "grant_admin") await db.prepare("INSERT OR REPLACE INTO site_admins(user_id,role,created_at) VALUES(?,'admin',CURRENT_TIMESTAMP)").bind(targetId).run();
    else {
      const role = await db.prepare("SELECT role FROM site_admins WHERE user_id=?").bind(targetId).first<{ role:string }>();
      if (role?.role === "owner") return Response.json({ error: "不能移除所有者" }, { status: 409 });
      await db.prepare("DELETE FROM site_admins WHERE user_id=? AND role='admin'").bind(targetId).run();
    }
    await logAdminAction(db, admin.id, action, "user", targetId, target.email);
  } else if (action === "resolve_report" || action === "restore_report") {
    const report = await db.prepare("SELECT id,target_type,target_id FROM site_reports WHERE id=? AND status='pending'").bind(Number(targetId)).first<{ id:number; target_type:string; target_id:string }>();
    if (!report) return Response.json({ error: "这条举报已经处理过了" }, { status: 409 });
    if (action === "restore_report" && report.target_type === "creation") {
      const hidden = await db.prepare("SELECT previous_visibility FROM admin_hidden_creations WHERE creation_id=?").bind(Number(report.target_id)).first<{ previous_visibility:string }>();
      if (hidden) await db.batch([db.prepare("UPDATE creations SET visibility=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND visibility='admin_hidden'").bind(hidden.previous_visibility, Number(report.target_id)), db.prepare("DELETE FROM admin_hidden_creations WHERE creation_id=?").bind(Number(report.target_id))]);
    }
    await db.prepare("UPDATE site_reports SET status='resolved',resolved_at=CURRENT_TIMESTAMP,resolved_by=? WHERE id=? AND status='pending'").bind(admin.id, Number(targetId)).run();
    await logAdminAction(db, admin.id, action, "report", targetId);
  } else return Response.json({ error: "不支持这个操作" }, { status: 400 });
  return Response.json({ ok: true });
}
