import { ensureAuthTables, normalizeEmail, runtime, sameOrigin, sha256 } from "../../../../lib/auth";

type Intent = "register" | "recover";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const body = await request.json() as { email?: string; code?: string; intent?: Intent; acceptTerms?: boolean };
  const email = normalizeEmail(body.email), code = String(body.code || "").trim(), intent = body.intent;
  const db = runtime().DB;
  if (!email || !/^\d{6}$/.test(code) || !["register", "recover"].includes(String(intent))) return Response.json({ error: "验证信息不完整" }, { status: 400 });
  if (!db) return Response.json({ error: "登录服务尚未配置完成" }, { status: 503 });
  await ensureAuthTables(db);

  const challenge = await db.prepare("SELECT id,code_hash,attempts,expires_at,consumed_at FROM email_challenges WHERE email=? ORDER BY created_at DESC LIMIT 1").bind(email).first<{ id: string; code_hash: string; attempts: number; expires_at: string; consumed_at: string | null }>();
  if (!challenge || challenge.consumed_at || new Date(challenge.expires_at) <= new Date() || challenge.attempts >= 5) return Response.json({ error: "验证码已失效，请重新获取" }, { status: 400 });
  if (await sha256(`${challenge.id}:${code}`) !== challenge.code_hash) {
    await db.prepare("UPDATE email_challenges SET attempts=attempts+1 WHERE id=?").bind(challenge.id).run();
    return Response.json({ error: "验证码错误" }, { status: 400 });
  }

  const user = await db.prepare("SELECT id,display_name,disabled_at FROM users WHERE email=?").bind(email).first<{ id: string; display_name: string; disabled_at: string | null }>();
  if (user?.disabled_at) return Response.json({ error: "这个账号已被管理员禁用" }, { status: 403 });
  if (intent === "register" && user) return Response.json({ error: "这个邮箱已经注册，请直接登录或找回密码" }, { status: 409 });
  if (intent === "register" && !body.acceptTerms) return Response.json({ error: "请先同意用户协议和隐私政策" }, { status: 409 });
  if (intent === "recover" && !user) return Response.json({ error: "未找到这个账号，请先注册" }, { status: 404 });

  const userId = user?.id || crypto.randomUUID();
  const displayName = user?.display_name || email.split("@")[0].slice(0, 24);
  const statements = [db.prepare("UPDATE email_challenges SET consumed_at=CURRENT_TIMESTAMP WHERE id=?").bind(challenge.id)];
  if (!user) statements.push(db.prepare("INSERT INTO users(id,email,display_name,terms_version,terms_accepted_at) VALUES(?,?,?,?,?)").bind(userId, email, displayName, "2026-09-25", new Date().toISOString()));
  await db.batch(statements);

  const token = crypto.randomUUID() + crypto.randomUUID().replaceAll("-", "");
  await db.prepare("INSERT INTO user_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)").bind(await sha256(token), userId, new Date(Date.now() + 604800000).toISOString()).run();
  return Response.json({ ok: true }, { headers: { "Set-Cookie": `first_look_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800` } });
}
