import { currentUser, runtime } from "../../../lib/auth";
import { ensureAdminTables } from "../../../lib/admin";
import { ensureCreationTables } from "../../../lib/creations";

export async function GET(request: Request) {
  const user = await currentUser(request), db = runtime().DB;
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  if (!db) return Response.json({ error: "数据库暂不可用" }, { status: 503 });
  await ensureCreationTables(db);
  await ensureAdminTables(db);

  const [likes, favorites, shares, reports] = await Promise.all([
    db.prepare("SELECT l.id,c.id AS creation_id,c.slug,c.title,c.creator_name,c.visibility,l.created_at FROM creation_likes l JOIN creations c ON c.id=l.creation_id WHERE l.user_id=? ORDER BY l.created_at DESC,l.id DESC LIMIT 100").bind(user.id).all(),
    db.prepare("SELECT f.id,c.id AS creation_id,c.slug,c.title,c.creator_name,c.visibility,f.created_at FROM creation_favorites f JOIN creations c ON c.id=f.creation_id WHERE f.user_id=? ORDER BY f.created_at DESC,f.id DESC LIMIT 100").bind(user.id).all(),
    db.prepare("SELECT s.id,c.id AS creation_id,c.slug,c.title,c.creator_name,c.visibility,s.source,s.created_at FROM creation_shares s JOIN creations c ON c.id=s.creation_id WHERE s.user_id=? ORDER BY s.created_at DESC,s.id DESC LIMIT 100").bind(user.id).all(),
    db.prepare("SELECT r.id,r.target_id,r.reason,r.detail,r.status,r.created_at,c.slug,c.title,c.creator_name,c.visibility FROM site_reports r LEFT JOIN creations c ON c.id=CAST(r.target_id AS INTEGER) WHERE r.reporter_id=? AND r.target_type='creation' ORDER BY r.created_at DESC,r.id DESC LIMIT 100").bind(user.id).all(),
  ]);

  return Response.json({ likes: likes.results, favorites: favorites.results, shares: shares.results, reports: reports.results });
}
