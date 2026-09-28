import { currentAdmin, logAdminAction } from "../../lib/admin";
import { runtime, sameOrigin } from "../../lib/auth";
import { ensureAnnouncementTable } from "../../lib/announcements";

export async function GET(request: Request) {
  const db = runtime().DB;
  if (!db) return Response.json({ error: "公告暂不可用" }, { status: 503 });
  const managing = new URL(request.url).searchParams.get("manage") === "1";
  if (managing && !await currentAdmin(request)) return Response.json({ error: "没有管理权限" }, { status: 403 });
  await ensureAnnouncementTable(db);
  const rows = await db.prepare(managing
    ? "SELECT id,title,content,url,status FROM site_announcements ORDER BY id DESC LIMIT 100"
    : "SELECT id,title,content,url FROM site_announcements WHERE status='published' ORDER BY id DESC LIMIT 20").all();
  return Response.json({ announcements: rows.results }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const db = runtime().DB;
  if (!db) return Response.json({ error: "公告暂不可用" }, { status: 503 });
  const admin = await currentAdmin(request);
  if (!admin) return Response.json({ error: "只有站长和管理员可以发布公告" }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "公告格式无效" }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ error: "公告格式无效" }, { status: 400 });
  const id = body.id == null ? null : Number(body.id);
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  let url = typeof body.url === "string" ? body.url.trim() : "";
  const status = body.status;
  if ((id !== null && (!Number.isSafeInteger(id) || id < 1)) || !title || title.length > 40 || !content || content.length > 240 || url.length > 2000 || (status !== "published" && status !== "unpublished")) {
    return Response.json({ error: "请填写标题（最多40字）、内容（最多240字）和有效发布状态" }, { status: 400 });
  }
  if (url) {
    try { const parsed = new URL(url); if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) throw Error(); url = parsed.href; }
    catch { return Response.json({ error: "链接必须是完整的 HTTP 或 HTTPS 地址" }, { status: 400 }); }
  }
  await ensureAnnouncementTable(db);
  if (id !== null) {
    if (!await db.prepare("SELECT id FROM site_announcements WHERE id=?").bind(id).first()) return Response.json({ error: "找不到这条公告" }, { status: 404 });
    await db.prepare("UPDATE site_announcements SET title=?,content=?,url=?,status=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(title,content,url || null,status,admin.id,id).run();
  } else {
    await db.prepare("INSERT INTO site_announcements(title,content,url,status,updated_by) VALUES(?,?,?,?,?)").bind(title,content,url || null,status,admin.id).run();
  }
  await logAdminAction(db,admin.id,"save_announcement","announcement",String(id ?? "new"),`${title} · ${status === "published" ? "已发布" : "已下架"}`);
  return Response.json({ ok: true });
}
