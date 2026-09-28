export type Announcement = { id: number; title: string; content: string; url: string | null; status: "published" | "unpublished" };

export async function ensureAnnouncementTable(db: D1Database) {
  await db.prepare("CREATE TABLE IF NOT EXISTS site_announcements (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,content TEXT NOT NULL,url TEXT,status TEXT NOT NULL DEFAULT 'unpublished' CHECK(status IN ('published','unpublished')),updated_by TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
}
