import { readTechnical } from "./technical";

type CreationDb = D1Database;

export async function ensureCreationTables(db: CreationDb) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS creation_technical (creation_id INTEGER PRIMARY KEY,notes TEXT NOT NULL DEFAULT '',links_json TEXT NOT NULL DEFAULT '[]')"),
    db.prepare("CREATE TABLE IF NOT EXISTS creation_technical_files (object_key TEXT PRIMARY KEY,creation_id INTEGER NOT NULL,name TEXT NOT NULL,size INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS creation_version_technical (version_id INTEGER PRIMARY KEY,data_json TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS creation_media (id INTEGER PRIMARY KEY AUTOINCREMENT,creation_id INTEGER NOT NULL,object_key TEXT UNIQUE NOT NULL,media_type TEXT NOT NULL,mime_type TEXT NOT NULL,size INTEGER NOT NULL,sort_order INTEGER NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS creation_versions (id INTEGER PRIMARY KEY AUTOINCREMENT,creation_id INTEGER NOT NULL,creator_id TEXT NOT NULL,version_number INTEGER NOT NULL,title TEXT NOT NULL,description TEXT NOT NULL,type TEXT NOT NULL,status TEXT NOT NULL,story TEXT NOT NULL,tags TEXT NOT NULL DEFAULT '',product_url TEXT NOT NULL DEFAULT '',change_note TEXT NOT NULL DEFAULT '',media_json TEXT NOT NULL DEFAULT '[]',created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,UNIQUE(creation_id,version_number))"),
    db.prepare("CREATE TABLE IF NOT EXISTS creation_events (id INTEGER PRIMARY KEY AUTOINCREMENT,creation_id INTEGER NOT NULL,actor_id TEXT NOT NULL,event_type TEXT NOT NULL,version_number INTEGER,likes_total INTEGER,detail TEXT NOT NULL DEFAULT '',created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS creation_likes (id INTEGER PRIMARY KEY AUTOINCREMENT,creation_id INTEGER NOT NULL,user_id TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,UNIQUE(creation_id,user_id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS creation_favorites (id INTEGER PRIMARY KEY AUTOINCREMENT,creation_id INTEGER NOT NULL,user_id TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,UNIQUE(creation_id,user_id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS creation_views (id INTEGER PRIMARY KEY AUTOINCREMENT,creation_id INTEGER NOT NULL,visitor_key TEXT NOT NULL,bucket TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,UNIQUE(creation_id,visitor_key,bucket))"),
    db.prepare("CREATE TABLE IF NOT EXISTS creation_shares (id INTEGER PRIMARY KEY AUTOINCREMENT,creation_id INTEGER NOT NULL,source TEXT NOT NULL DEFAULT 'copy-link',created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS creation_favorites (id INTEGER PRIMARY KEY AUTOINCREMENT,creation_id INTEGER NOT NULL,user_id TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,UNIQUE(creation_id,user_id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS creation_views (id INTEGER PRIMARY KEY AUTOINCREMENT,creation_id INTEGER NOT NULL,visitor_key TEXT NOT NULL,bucket TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,UNIQUE(creation_id,visitor_key,bucket))"),
    db.prepare("CREATE TABLE IF NOT EXISTS creation_shares (id INTEGER PRIMARY KEY AUTOINCREMENT,creation_id INTEGER NOT NULL,source TEXT NOT NULL DEFAULT 'copy-link',created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)"),
  ]);
  try { await db.prepare("ALTER TABLE creations ADD COLUMN contact_email_visible INTEGER NOT NULL DEFAULT 0").run(); } catch {}
  for (const statement of ["ALTER TABLE creations ADD COLUMN tags TEXT NOT NULL DEFAULT ''", "ALTER TABLE creations ADD COLUMN product_url TEXT NOT NULL DEFAULT ''", "ALTER TABLE creations ADD COLUMN updated_at TEXT"]) { try { await db.prepare(statement).run(); } catch {} }
  try { await db.prepare("UPDATE creations SET updated_at=created_at WHERE updated_at IS NULL").run(); } catch {}
}

export async function createCreationVersion(db: CreationDb, creationId: number, creatorId: string, changeNote = "") {
  await ensureCreationTables(db);
  const creation = await db.prepare("SELECT id,creator_id,title,description,type,status,story,tags,product_url FROM creations WHERE id=?").bind(creationId).first<Record<string, unknown>>();
  if (!creation) throw new Error("作品不存在");
  const count = await db.prepare("SELECT COALESCE(MAX(version_number),0) AS version FROM creation_versions WHERE creation_id=?").bind(creationId).first<{ version: number }>();
  const media = await db.prepare("SELECT object_key,media_type,mime_type,size,sort_order FROM creation_media WHERE creation_id=? ORDER BY sort_order").bind(creationId).all();
  const version = Number(count?.version || 0) + 1;
  await db.prepare("INSERT INTO creation_versions(creation_id,creator_id,version_number,title,description,type,status,story,tags,product_url,change_note,media_json)VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").bind(creationId,creatorId,version,creation.title,creation.description,creation.type,creation.status,creation.story||"",creation.tags||"",creation.product_url||"",changeNote,JSON.stringify(media.results||[])).run();
  const savedVersion = await db.prepare("SELECT id FROM creation_versions WHERE creation_id=? AND version_number=?").bind(creationId,version).first<{id:number}>();
  if (savedVersion) await db.prepare("INSERT INTO creation_version_technical(version_id,data_json) VALUES(?,?)").bind(savedVersion.id,JSON.stringify(await readTechnical(db,creationId))).run();
  const likes = await db.prepare("SELECT COUNT(*) AS total FROM creation_likes WHERE creation_id=?").bind(creationId).first<{total:number}>();
  await db.prepare("INSERT INTO creation_events(creation_id,actor_id,event_type,version_number,likes_total,detail)VALUES(?,?,?,?,?,?)").bind(creationId,creatorId,version===1?"published":"updated",version,Number(likes?.total||0),changeNote).run();
  return version;
}

export async function recordCreationEvent(db: CreationDb, creationId: number, actorId: string, eventType: string, detail = "", likesTotal: number | null = null) {
  await ensureCreationTables(db);
  const latest = await db.prepare("SELECT MAX(version_number) AS version FROM creation_versions WHERE creation_id=?").bind(creationId).first<{version:number|null}>();
  await db.prepare("INSERT INTO creation_events(creation_id,actor_id,event_type,version_number,likes_total,detail)VALUES(?,?,?,?,?,?)").bind(creationId,actorId,eventType,latest?.version ?? null,likesTotal,detail).run();
}

export function parseTags(value: unknown) { return String(value || "").split(/[，,\n]/).map((tag) => tag.trim()).filter(Boolean).slice(0, 8).join(","); }
