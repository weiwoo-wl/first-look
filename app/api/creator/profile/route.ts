import { currentUser, runtime, sameOrigin } from "../../../lib/auth";
import { ensureCreatorProfileTables, ensureHandleForUser, normalizeHandle, validateHandle } from "../../../lib/creator-profile";

export async function GET(request: Request) {
  const user = await currentUser(request), db = runtime().DB;
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  if (!db) return Response.json({ error: "数据库暂不可用" }, { status: 503 });
  const handle = await ensureHandleForUser(db, user);
  const profile = await db.prepare("SELECT display_name,handle,bio,avatar_key,contact_enabled FROM users WHERE id=?").bind(user.id).first<Record<string, unknown>>();
  return Response.json({ profile: { ...profile, handle, email: user.email, avatarUrl: profile?.avatar_key ? `/api/creator/avatar?handle=${encodeURIComponent(handle)}&v=${encodeURIComponent(String(profile.avatar_key))}` : null } });
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const user = await currentUser(request), db = runtime().DB;
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  if (!db) return Response.json({ error: "数据库暂不可用" }, { status: 503 });
  await ensureCreatorProfileTables(db);
  const body = await request.json() as { displayName?: string; handle?: string; bio?: string; contactEnabled?: boolean };
  const displayName = String(body.displayName || "").trim(), handle = normalizeHandle(body.handle), bio = String(body.bio || "").trim();
  if (displayName.length < 2 || displayName.length > 24) return Response.json({ error: "显示名称需要为 2 到 24 个字" }, { status: 400 });
  const handleError = validateHandle(handle);
  if (handleError) return Response.json({ error: handleError }, { status: 400 });
  if (bio.length > 300) return Response.json({ error: "个人介绍不能超过 300 个字" }, { status: 400 });
  const previous = await db.prepare("SELECT handle FROM users WHERE id=?").bind(user.id).first<{ handle: string | null }>();
  const historicalOwner = await db.prepare("SELECT user_id FROM creator_handle_history WHERE handle=? COLLATE NOCASE").bind(handle).first<{ user_id: string }>();
  if (historicalOwner && historicalOwner.user_id !== user.id) return Response.json({ error: "这个主页名称已经有人使用" }, { status: 409 });
  try {
    if (previous?.handle && previous.handle.toLowerCase() !== handle) await db.prepare("INSERT OR IGNORE INTO creator_handle_history(handle,user_id) VALUES(?,?)").bind(previous.handle, user.id).run();
    await db.prepare("UPDATE users SET display_name=?,handle=?,bio=?,contact_enabled=? WHERE id=?").bind(displayName, handle, bio, body.contactEnabled ? 1 : 0, user.id).run();
    await db.prepare("UPDATE creations SET creator_name=? WHERE creator_id=?").bind(displayName, user.id).run();
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) return Response.json({ error: "这个主页名称已经有人使用" }, { status: 409 });
    throw error;
  }
  return Response.json({ ok: true, handle });
}
