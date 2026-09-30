import { runtime, sameOrigin } from "../../../lib/auth";
import { ensureSiteVisitTable, siteDate } from "../../../lib/site-analytics";
import { readVisitorId } from "../../../lib/visitor-identity";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const db = runtime().DB;
  if (!db) return new Response(null, { status: 503 });

  const existing = readVisitorId(request);
  const visitorId = existing || crypto.randomUUID();
  await ensureSiteVisitTable(db);
  await db.prepare("INSERT OR IGNORE INTO site_daily_visitors (visit_date, visitor_id) VALUES (?, ?)").bind(siteDate(), visitorId).run();

  const headers = new Headers({ "Cache-Control": "no-store" });
  if (!existing) headers.append("Set-Cookie", `firstlook_viewer=${visitorId}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure`);
  return new Response(null, { status: 204, headers });
}
