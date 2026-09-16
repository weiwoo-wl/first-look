import { env } from "cloudflare:workers";

export async function GET(request: Request) {
  const config = env as unknown as { GITHUB_CLIENT_ID?: string; DB?: D1Database };
  if (new URL(request.url).searchParams.has("session")) {
    const id = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)first_look_session=([a-f0-9-]{36})(?:;|$)/)?.[1];
    if (!id || !config.DB) return Response.json({ user: null }, { headers: { "Cache-Control": "no-store" } });
    const session = await config.DB.prepare("SELECT display_name, github_login FROM sessions WHERE id = ? AND expires_at > ?").bind(id, new Date().toISOString()).first();
    return Response.json({ user: session }, { headers: { "Cache-Control": "no-store" } });
  }
  if (!config.GITHUB_CLIENT_ID) return new Response("登录配置尚未完成", { status: 503 });
  const origin = new URL(request.url).origin;
  const state = crypto.randomUUID();
  const target = new URL("https://github.com/login/oauth/authorize");
  target.searchParams.set("client_id", config.GITHUB_CLIENT_ID);
  target.searchParams.set("redirect_uri", `${origin}/api/auth/github/callback`);
  target.searchParams.set("state", state);
  return new Response(null, { status: 302, headers: {
    Location: target.toString(),
    "Set-Cookie": `__Host-first_look_oauth=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    "Cache-Control": "no-store",
  } });
}

export async function DELETE(request: Request) {
  if (request.headers.get("Origin") !== new URL(request.url).origin) return new Response(null, { status: 403 });
  const config = env as unknown as { DB?: D1Database };
  const id = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)first_look_session=([a-f0-9-]{36})(?:;|$)/)?.[1];
  if (id && config.DB) await config.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
  return new Response(null, { status: 204, headers: { "Set-Cookie": "first_look_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0", "Cache-Control": "no-store" } });
}
