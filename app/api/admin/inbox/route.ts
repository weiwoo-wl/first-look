import { currentAdmin } from "../../../lib/admin";
import { runtime } from "../../../lib/auth";
import { InboxError, listInbox, readInbox } from "../../../lib/inbox";

export async function GET(request: Request) {
  if (!await currentAdmin(request)) return Response.json({ error: "只有管理员可以查看收件箱" }, { status: 403 });
  const password = runtime().SERVER_SMTP_PASSWORD;
  if (!password) return Response.json({ error: "server 邮箱连接尚未配置" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const query = new URL(request.url).searchParams, id = query.get("id"), page = Number(query.get("page") || "1");
  if ((id && !/^\d{1,10}:\d{1,10}$/.test(id)) || !Number.isSafeInteger(page) || page < 1 || page > 100000) return Response.json({ error: "邮件信息无效" }, { status: 400 });
  try {
    const data = id ? { message: await readInbox(password, id) } : await listInbox(password, page);
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const kind = error instanceof InboxError ? error.kind : "connection";
    const message = { authentication: "邮箱登录失败，请确认安全密码和 IMAP 权限", stale: "邮箱列表已变化，请刷新收件箱", missing: "这封邮件不存在，请刷新列表", large: "邮件较大，请到阿里邮箱查看正文或附件", connection: "暂时无法连接阿里邮箱，请稍后刷新" }[kind];
    return Response.json({ error: message }, { status: kind === "missing" ? 404 : 502, headers: { "Cache-Control": "no-store" } });
  }
}
