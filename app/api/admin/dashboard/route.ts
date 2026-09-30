import { currentAdmin } from "../../../lib/admin";
import { runtime } from "../../../lib/auth";
import { ensureCreationTables } from "../../../lib/creations";
import { ensureEngagementTables } from "../../../lib/engagement";
import { ensureSiteVisitTable, recentSiteDates } from "../../../lib/site-analytics";

type DailyCount = { day: string; total: number };

export async function GET(request: Request) {
  const db = runtime().DB;
  if (!db) return Response.json({ error: "数据库暂不可用" }, { status: 503 });
  if (!await currentAdmin(request)) return Response.json({ error: "无权访问管理后台" }, { status: 403 });
  await Promise.all([ensureCreationTables(db), ensureSiteVisitTable(db)]);
  await ensureEngagementTables(db);

  const days = recentSiteDates(7);
  const start = days[0];
  const queries = {
    visitors: "SELECT visit_date AS day, COUNT(*) AS total FROM site_daily_visitors WHERE visit_date>=? GROUP BY visit_date",
    users: "SELECT date(created_at,'+8 hours') AS day, COUNT(*) AS total FROM users WHERE date(created_at,'+8 hours')>=? GROUP BY day",
    products: "SELECT date(created_at,'+8 hours') AS day, COUNT(*) AS total FROM creations WHERE visibility='published' AND date(created_at,'+8 hours')>=? GROUP BY day",
    views: "SELECT date(created_at,'+8 hours') AS day, COUNT(*) AS total FROM creation_views WHERE date(created_at,'+8 hours')>=? GROUP BY day",
    likes: "SELECT date(created_at,'+8 hours') AS day, COUNT(*) AS total FROM creation_events WHERE event_type='liked' AND date(created_at,'+8 hours')>=? GROUP BY day",
    favorites: "SELECT date(created_at,'+8 hours') AS day, COUNT(*) AS total FROM creation_events WHERE event_type='favorited' AND date(created_at,'+8 hours')>=? GROUP BY day",
    shares: "SELECT date(created_at,'+8 hours') AS day, COUNT(*) AS total FROM creation_shares WHERE date(created_at,'+8 hours')>=? GROUP BY day",
    shareOpens: "SELECT date(created_at,'+8 hours') AS day, COUNT(*) AS total FROM product_share_opens WHERE date(created_at,'+8 hours')>=? GROUP BY day",
  };
  const entries = await Promise.all(Object.entries(queries).map(async ([name, sql]) => [name, (await db.prepare(sql).bind(start).all<DailyCount>()).results] as const));
  const counts = Object.fromEntries(entries.map(([name, rows]) => [name, new Map(rows.map(row => [row.day, row.total]))])) as Record<keyof typeof queries, Map<string, number>>;
  const daily = days.map(day => ({ day, ...Object.fromEntries(Object.keys(queries).map(name => [name, counts[name as keyof typeof queries].get(day) || 0])) }));
  return Response.json({ daily }, { headers: { "Cache-Control": "no-store" } });
}
