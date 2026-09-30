import { currentUser, runtime } from "../../../lib/auth";
import { ensureCreationTables } from "../../../lib/creations";
export async function GET(request: Request) {
  const user = await currentUser(request), db = runtime().DB;
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  if (!db) return Response.json([]);
  await ensureCreationTables(db);
  const rows = await db.prepare("SELECT c.id,c.slug,c.title,c.description,c.type,c.status,c.story,c.tags,c.product_url,c.visibility,c.contact_email_visible,c.created_at,c.updated_at,(SELECT MAX(version_number) FROM creation_versions v WHERE v.creation_id=c.id) AS latest_version,(SELECT COUNT(*) FROM creation_events l WHERE l.creation_id=c.id AND l.event_type='liked') AS likes_total,t.links_json FROM creations c LEFT JOIN creation_technical t ON t.creation_id=c.id WHERE c.creator_id=? ORDER BY c.updated_at DESC,c.created_at DESC").bind(user.id).all<Record<string, unknown>>();
  return Response.json(rows.results.map((row) => {
    let saved: { miniProgram?: { name?: string; originalId?: string; entryVerified?: boolean } } = {};
    try { const data = JSON.parse(String(row.links_json || "[]")); saved = Array.isArray(data) ? {} : data || {}; } catch {}
    const { links_json: _private, ...product } = row;
    const mini = saved.miniProgram || {};
    const hasEntry = Boolean(row.product_url) || row.type === "小程序" && Boolean(mini.name || mini.originalId);
    return { ...product, has_entry: hasEntry, entry_verified: hasEntry && mini.entryVerified === true };
  }));
}
