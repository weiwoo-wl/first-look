import { env } from "cloudflare:workers";

export async function GET(request: Request) {
  const config = env as unknown as { GITHUB_CLIENT_ID?: string };
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
