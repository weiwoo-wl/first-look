import { ensureAuthTables, type SiteUser } from "./auth";

const RESERVED = new Set(["account", "admin", "api", "create", "creator", "login", "privacy", "terms", "work", "www"]);

export async function ensureCreatorProfileTables(db: D1Database) {
  await ensureAuthTables(db);
  for (const statement of [
    "ALTER TABLE users ADD COLUMN handle TEXT",
    "ALTER TABLE users ADD COLUMN avatar_key TEXT",
    "ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE users ADD COLUMN contact_enabled INTEGER NOT NULL DEFAULT 0",
  ]) { try { await db.prepare(statement).run(); } catch {} }
  await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS users_handle_unique ON users(handle COLLATE NOCASE) WHERE handle IS NOT NULL").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS creator_handle_history (handle TEXT PRIMARY KEY COLLATE NOCASE,user_id TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)").run();
}

export function normalizeHandle(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function validateHandle(value: unknown) {
  const handle = normalizeHandle(value);
  if (handle.length < 3 || handle.length > 30) return "主页名称需要为 3 到 30 个字符";
  if (!/^[a-z0-9_-]+$/.test(handle)) return "主页名称只能使用小写字母、数字、横线和下划线";
  if (RESERVED.has(handle)) return "这个主页名称不能使用";
  return null;
}

function baseHandle(user: SiteUser) {
  const cleaned = user.displayName.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 22);
  const suffix = user.id.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(-6) || crypto.randomUUID().slice(0, 6);
  return cleaned.length >= 3 && !RESERVED.has(cleaned) ? cleaned : `maker-${suffix}`;
}

export async function ensureHandleForUser(db: D1Database, user: SiteUser) {
  await ensureCreatorProfileTables(db);
  const existing = await db.prepare("SELECT handle FROM users WHERE id=?").bind(user.id).first<{ handle: string | null }>();
  if (existing?.handle) return existing.handle;
  const base = baseHandle(user);
  for (let index = 0; index < 20; index++) {
    const suffix = index ? `-${index + 1}` : "";
    const candidate = `${base.slice(0, 30 - suffix.length)}${suffix}`;
    try {
      await db.prepare("UPDATE users SET handle=? WHERE id=? AND handle IS NULL").bind(candidate, user.id).run();
      const row = await db.prepare("SELECT handle FROM users WHERE id=?").bind(user.id).first<{ handle: string }>();
      if (row?.handle) return row.handle;
    } catch {}
  }
  throw new Error("暂时无法生成主页名称");
}

export async function ensureHandlesForPublishedCreators(db: D1Database) {
  await ensureCreatorProfileTables(db);
  const rows = await db.prepare("SELECT DISTINCT u.id,u.email,u.display_name FROM users u JOIN creations c ON c.creator_id=u.id WHERE c.visibility='published' AND u.handle IS NULL").all<{ id: string; email: string; display_name: string }>();
  for (const row of rows.results) await ensureHandleForUser(db, { id: row.id, email: row.email, displayName: row.display_name });
}
