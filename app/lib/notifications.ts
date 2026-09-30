export type SiteNotification = {
  id: number;
  type: "announcement" | "product";
  title: string;
  summary: string;
  url: string | null;
  created_at: string;
  read_at: string | null;
};

export async function ensureNotificationTable(db: D1Database) {
  await db.prepare("CREATE TABLE IF NOT EXISTS site_announcements (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,content TEXT NOT NULL,url TEXT,status TEXT NOT NULL DEFAULT 'unpublished' CHECK(status IN ('published','unpublished')),updated_by TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS user_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT NOT NULL,type TEXT NOT NULL CHECK(type IN ('announcement','product')),title TEXT NOT NULL,summary TEXT NOT NULL,url TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,read_at TEXT)"),
    db.prepare("CREATE INDEX IF NOT EXISTS user_notifications_recipient_unread ON user_notifications(user_id,read_at,created_at DESC,id DESC)"),
    db.prepare("CREATE TABLE IF NOT EXISTS site_notification_meta (id INTEGER PRIMARY KEY CHECK(id=1),announcement_id_cutoff INTEGER NOT NULL)"),
  ]);
  await db.prepare("INSERT OR IGNORE INTO site_notification_meta(id,announcement_id_cutoff) SELECT 1,COALESCE(MAX(id),0) FROM site_announcements").run();
}
