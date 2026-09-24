import { currentUser, ensureAuthTables, runtime, type SiteUser } from "./auth";

export type AdminRole = "owner" | "admin";
export type AdminIdentity = SiteUser & { role: AdminRole };

export async function ensureAdminTables(db: D1Database) {
  await ensureAuthTables(db);
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS site_admins (user_id TEXT PRIMARY KEY,role TEXT NOT NULL DEFAULT 'admin',created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS admin_hidden_creations (creation_id INTEGER PRIMARY KEY,previous_visibility TEXT NOT NULL,hidden_by TEXT NOT NULL,hidden_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS site_reports (id INTEGER PRIMARY KEY AUTOINCREMENT,reporter_id TEXT,target_type TEXT NOT NULL,target_id TEXT NOT NULL,reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,resolved_at TEXT,resolved_by TEXT)"),
    db.prepare("CREATE TABLE IF NOT EXISTS admin_actions (id INTEGER PRIMARY KEY AUTOINCREMENT,admin_id TEXT NOT NULL,action TEXT NOT NULL,target_type TEXT NOT NULL,target_id TEXT NOT NULL,detail TEXT NOT NULL DEFAULT '',created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)"),
  ]);
  await db.prepare("INSERT OR IGNORE INTO site_admins(user_id,role) SELECT id,'owner' FROM users ORDER BY created_at ASC,id ASC LIMIT 1").run();
}

export async function currentAdmin(request: Request): Promise<AdminIdentity | null> {
  const db = runtime().DB;
  const user = await currentUser(request);
  if (!db || !user) return null;
  await ensureAdminTables(db);
  const admin = await db.prepare("SELECT role FROM site_admins WHERE user_id=?").bind(user.id).first<{ role: AdminRole }>();
  return admin ? { ...user, role: admin.role } : null;
}

export async function logAdminAction(db: D1Database, adminId: string, action: string, targetType: string, targetId: string, detail = "") {
  await db.prepare("INSERT INTO admin_actions(admin_id,action,target_type,target_id,detail) VALUES(?,?,?,?,?)").bind(adminId, action, targetType, targetId, detail).run();
}
