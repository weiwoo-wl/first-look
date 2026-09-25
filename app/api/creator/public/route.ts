import { currentUser, runtime } from "../../../lib/auth";
import { ensureCreatorProfileTables } from "../../../lib/creator-profile";

export async function GET(request: Request) {
  const db = runtime().DB, handle = String(new URL(request.url).searchParams.get("handle") || "").toLowerCase();
  if (!db || !handle) return Response.json({ error: "创作者不存在" }, { status: 404 });
  await ensureCreatorProfileTables(db);
  let profile = await db.prepare("SELECT id,email,display_name,handle,bio,avatar_key,contact_enabled,created_at FROM users WHERE handle=? COLLATE NOCASE AND disabled_at IS NULL").bind(handle).first<Record<string, unknown>>();
  if (!profile) {
    const history = await db.prepare("SELECT u.handle FROM creator_handle_history h JOIN users u ON u.id=h.user_id WHERE h.handle=? COLLATE NOCASE").bind(handle).first<{ handle: string }>();
    if (history?.handle) return Response.json({ redirectHandle: history.handle });
    return Response.json({ error: "创作者不存在" }, { status: 404 });
  }
  const viewer = await currentUser(request), products = await db.prepare("SELECT c.id,c.slug,c.title,c.description,c.type,c.status,c.tags,c.created_at,(SELECT COUNT(*) FROM creation_likes l WHERE l.creation_id=c.id) AS likes,(SELECT COUNT(*) FROM creation_favorites f WHERE f.creation_id=c.id) AS favorites,(SELECT COUNT(*) FROM creation_views v WHERE v.creation_id=c.id) AS views FROM creations c WHERE c.creator_id=? AND c.visibility='published' ORDER BY c.created_at DESC").bind(profile.id).all<Record<string, unknown>>();
  const enriched = await Promise.all(products.results.map(async product => ({ ...product, media: await db.prepare("SELECT object_key,media_type,mime_type,sort_order FROM creation_media WHERE creation_id=? ORDER BY sort_order LIMIT 1").bind(product.id).all().then(result => result.results).catch(() => []) })));
  const currentHandle = String(profile.handle);
  return Response.json({ profile: { displayName: profile.display_name, handle: currentHandle, bio: profile.bio, createdAt: profile.created_at, avatarUrl: profile.avatar_key ? `/api/creator/avatar?handle=${encodeURIComponent(currentHandle)}&v=${encodeURIComponent(String(profile.avatar_key))}` : null, contactEmail: profile.contact_enabled ? profile.email : null, isOwner: viewer?.id === profile.id }, products: enriched });
}
