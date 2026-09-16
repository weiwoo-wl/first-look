import { env } from "cloudflare:workers";

export async function GET(request: Request) {
  const config = env as unknown as { GITHUB_CLIENT_ID?: string; GITHUB_CLIENT_SECRET?: string; DB?: D1Database };
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const expected = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)__Host-first_look_oauth=([^;]+)/)?.[1];
  if (!state || !expected || state !== expected) return new Response("登录验证失败，请重新登录", { status: 400 });
  const code = url.searchParams.get("code");
  if (!code || !config.GITHUB_CLIENT_ID || !config.GITHUB_CLIENT_SECRET || !config.DB) return new Response("登录配置尚未完成", { status: 503 });
  const response = await fetch("https://github.com/login/oauth/access_token", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ client_id: config.GITHUB_CLIENT_ID, client_secret: config.GITHUB_CLIENT_SECRET, code, redirect_uri: `${url.origin}/api/auth/github/callback` }) });
  const token = await response.json() as { access_token?: string };
  if (!response.ok || !token.access_token) return new Response("GitHub 授权失败，请重新登录", { status: 401 });
  const identityResponse = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/vnd.github+json", "User-Agent": "First-Look" } });
  const user = await identityResponse.json() as { id?: number; login?: string; name?: string };
  if (!identityResponse.ok || !user.id || !user.login) return new Response("无法验证 GitHub 身份", { status: 401 });
  await config.DB.prepare("CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, github_id TEXT NOT NULL, github_login TEXT NOT NULL, display_name TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL, expires_at TEXT NOT NULL)").run();
  const session = crypto.randomUUID();
  await config.DB.prepare("INSERT INTO sessions (id, github_id, github_login, display_name, expires_at) VALUES (?, ?, ?, ?, ?)").bind(session, String(user.id), user.login, user.name || user.login, new Date(Date.now() + 604800000).toISOString()).run();
  const headers = new Headers({ Location: "/create", "Cache-Control": "no-store" });
  headers.append("Set-Cookie", `first_look_session=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`);
  headers.append("Set-Cookie", "__Host-first_look_oauth=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  return new Response(null, { status: 302, headers });
}
