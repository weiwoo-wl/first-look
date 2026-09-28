const viewerCookieName = "firstlook_viewer";

export function readVisitorId(request: Request) {
  const value = request.headers.get("Cookie")?.match(/(?:^|;\s*)firstlook_viewer=([a-f\d-]{36})(?:;|$)/i)?.[1];
  return value && /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value) ? value : null;
}

export function visitorJson(request: Request, visitorId: string, body: unknown) {
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8" });
  if (!readVisitorId(request)) headers.set("Set-Cookie", `${viewerCookieName}=${visitorId}; Max-Age=31536000; Path=/; SameSite=Lax; Secure; HttpOnly`);
  return new Response(JSON.stringify(body), { headers });
}
