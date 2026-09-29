import { adminRoleForUser } from "./admin";
import { currentUser } from "./auth";
import { readVisitorId } from "./visitor-identity";

export async function ensureEngagementTables(db: D1Database) {
  try {
    if (await db.prepare("SELECT name FROM engagement_migrations WHERE name='cumulative-v1'").first()) return;
  } catch {}
  for (const sql of ["ALTER TABLE creation_events ADD COLUMN request_key TEXT", "ALTER TABLE creation_events ADD COLUMN self_once TEXT", "ALTER TABLE creation_shares ADD COLUMN share_token TEXT"]) {
    try { await db.prepare(sql).run(); } catch {}
  }
  await db.batch([
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS interaction_request ON creation_events(request_key)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS interaction_self_once ON creation_events(self_once)"),
    db.prepare("CREATE INDEX IF NOT EXISTS interaction_counts ON creation_events(creation_id,event_type,created_at)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS confirmed_share_token ON creation_shares(share_token)"),
    db.prepare("CREATE TABLE IF NOT EXISTS product_share_links (token TEXT PRIMARY KEY,creation_id INTEGER NOT NULL,actor_id TEXT NOT NULL,visitor_id TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS product_share_opens (creation_id INTEGER NOT NULL,visitor_key TEXT NOT NULL,visitor_id TEXT NOT NULL,share_token TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(creation_id,visitor_key),UNIQUE(creation_id,visitor_id))"),
    db.prepare("CREATE INDEX IF NOT EXISTS share_open_date ON product_share_opens(creation_id,created_at)"),
    db.prepare("CREATE TABLE IF NOT EXISTS product_share_seen (creation_id INTEGER NOT NULL,identity_key TEXT NOT NULL,PRIMARY KEY(creation_id,identity_key))"),
    db.prepare("CREATE TABLE IF NOT EXISTS engagement_migrations (name TEXT PRIMARY KEY)"),
  ]);
  if (!await db.prepare("SELECT name FROM engagement_migrations WHERE name='cumulative-v1'").first()) {
    await db.batch([
      db.prepare("INSERT OR IGNORE INTO creation_events(creation_id,actor_id,event_type,detail,created_at,request_key) SELECT l.creation_id,l.user_id,'liked','历史喜欢',l.created_at,'legacy-like:'||l.id FROM creation_likes l WHERE NOT EXISTS(SELECT 1 FROM creation_events e WHERE e.creation_id=l.creation_id AND e.actor_id=l.user_id AND e.event_type='liked')"),
      db.prepare("INSERT OR IGNORE INTO creation_events(creation_id,actor_id,event_type,detail,created_at,request_key) SELECT f.creation_id,f.user_id,'favorited','历史收藏',f.created_at,'legacy-favorite:'||f.id FROM creation_favorites f WHERE NOT EXISTS(SELECT 1 FROM creation_events e WHERE e.creation_id=f.creation_id AND e.actor_id=f.user_id AND e.event_type='favorited')"),
      db.prepare("INSERT OR IGNORE INTO engagement_migrations(name) VALUES('cumulative-v1')"),
    ]);
  }
}

export async function interactionIdentity(request: Request, db: D1Database) {
  const user = await currentUser(request), visitorId = readVisitorId(request) || crypto.randomUUID();
  return { user, visitorId, actor: user?.id || `visitor:${visitorId}`, owner: Boolean(user && await adminRoleForUser(db, user.id) === "owner") };
}

export function validRequestId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value);
}

export async function countInteraction(db: D1Database, product: { id: number; creator_id: string }, identity: Awaited<ReturnType<typeof interactionIdentity>>, kind: "liked" | "favorited", requestId: string) {
  const limited = identity.user?.id === product.creator_id && !identity.owner;
  const key = `${identity.actor}:${product.id}:${kind}:${requestId}`;
  const once = limited ? `${identity.actor}:${product.id}:${kind}` : null;
  const table = kind === "liked" ? "creation_likes" : "creation_favorites";
  // Unique keys protect retries and simultaneous self-clicks; deliberate new clicks use new keys.
  const results = await db.batch([
    db.prepare(`INSERT OR IGNORE INTO ${table}(creation_id,user_id) SELECT ?,? WHERE NOT EXISTS(SELECT 1 FROM creation_events WHERE request_key=?) AND (?=0 OR NOT EXISTS(SELECT 1 FROM creation_events WHERE creation_id=? AND actor_id=? AND event_type=?))`).bind(product.id,identity.actor,key,limited ? 1 : 0,product.id,identity.actor,kind),
    db.prepare("INSERT OR IGNORE INTO creation_events(creation_id,actor_id,event_type,detail,request_key,self_once) SELECT ?,?,?,?,?,? WHERE ?=0 OR NOT EXISTS(SELECT 1 FROM creation_events WHERE creation_id=? AND actor_id=? AND event_type=?)").bind(product.id,identity.actor,kind,kind === "liked" ? "喜欢了产品" : "收藏了产品",key,once,limited ? 1 : 0,product.id,identity.actor,kind),
  ]);
  return { counted: Number(results[1].meta.changes || 0) > 0, limited };
}

export function engagementColumns(alias = "c") {
  return `(SELECT COUNT(*) FROM creation_events e WHERE e.creation_id=${alias}.id AND e.event_type='liked') AS likes,(SELECT COUNT(*) FROM creation_events e WHERE e.creation_id=${alias}.id AND e.event_type='favorited') AS favorites,(SELECT COUNT(*) FROM creation_shares s WHERE s.creation_id=${alias}.id) AS shares,(SELECT COUNT(*) FROM product_share_opens o WHERE o.creation_id=${alias}.id) AS share_opens,(SELECT COUNT(*) FROM creation_views v WHERE v.creation_id=${alias}.id) AS views`;
}

export async function engagementTotals(db: D1Database, id: number) {
  const row = await db.prepare(`SELECT ${engagementColumns()} FROM creations c WHERE c.id=?`).bind(id).first<{ likes:number; favorites:number; shares:number; share_opens:number; views:number }>();
  return row || { likes:0, favorites:0, shares:0, share_opens:0, views:0 };
}

export function engagementPeriodColumns(days: 7 | 30, alias = "c") {
  return [["creation_events","liked","likes"],["creation_events","favorited","favorites"],["creation_shares",null,"shares"],["product_share_opens",null,"share_opens"]].map(([table,kind,name]) => `(SELECT COUNT(*) FROM ${table} e WHERE e.creation_id=${alias}.id${kind ? ` AND e.event_type='${kind}'` : ""} AND e.created_at>=datetime('now','-${days} days')) AS ${name}_${days}d`).join(",");
}

export function isKnownBot(request: Request) {
  return /bot\b|crawler|spider|preview|slurp|headless|facebookexternalhit|whatsapp|telegrambot|discordbot|bytespider|lighthouse/i.test(request.headers.get("User-Agent") || "") || /prefetch|prerender/i.test(request.headers.get("Purpose") || request.headers.get("Sec-Purpose") || "");
}
