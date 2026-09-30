export const ANALYTICS_TIME_ZONE = "Asia/Shanghai";

export function siteDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ANALYTICS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

export function recentSiteDates(days: number) {
  const today = siteDate();
  const date = new Date(`${today}T00:00:00+08:00`);
  return Array.from({ length: days }, (_, index) => siteDate(new Date(date.getTime() - (days - index - 1) * 86400000)));
}

export async function ensureSiteVisitTable(db: D1Database) {
  await db.prepare("CREATE TABLE IF NOT EXISTS site_daily_visitors (visit_date TEXT NOT NULL, visitor_id TEXT NOT NULL, PRIMARY KEY (visit_date, visitor_id))").run();
}
