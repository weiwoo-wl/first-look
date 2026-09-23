type CreationDb = D1Database;

export async function ensureCreationTables(db: CreationDb) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS creation_media (id INTEGER PRIMARY KEY AUTOINCREMENT,creation_id INTEGER NOT NULL,object_key TEXT UNIQUE NOT NULL,media_type TEXT NOT NULL,mime_type TEXT NOT NULL,size INTEGER NOT NULL,sort_order INTEGER NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS creation_versions (id INTEGER PRIMARY KEY AUTOINCREMENT,creation_id INTEGER NOT NULL,creator_id TEXT NOT NULL,version_number INTEGER NOT NULL,title TEXT NOT NULL,description TEXT NOT NULL,type TEXT NOT NULL,status TEXT NOT NULL,story TEXT NOT NULL,tags TEXT NOT NULL DEFAULT '',product_url TEXT NOT NULL DEFAULT '',change_note TEXT NOT NULL DEFAULT '',media_json TEXT NOT NULL DEFAULT '[]',created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,UNIQUE(creation_id,version_number))"),
  ]);
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
  return version;
}

export function parseTags(value: unknown) { return String(value || "").split(/[，,\n]/).map((tag) => tag.trim()).filter(Boolean).slice(0, 8).join(","); }
