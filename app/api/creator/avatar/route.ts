import { currentUser, runtime, sameOrigin } from "../../../lib/auth";
import { ensureCreatorProfileTables, ensureHandleForUser } from "../../../lib/creator-profile";

const allowed = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);

export async function GET(request: Request) {
  const { DB: db, MEDIA: bucket } = runtime(), handle = new URL(request.url).searchParams.get("handle");
  if (!db || !bucket || !handle) return new Response(null, { status: 404 });
  await ensureCreatorProfileTables(db);
  const profile = await db.prepare("SELECT avatar_key FROM users WHERE handle=? COLLATE NOCASE").bind(handle).first<{ avatar_key: string | null }>();
  if (!profile?.avatar_key) return new Response(null, { status: 404 });
  const object = await bucket.get(profile.avatar_key);
  if (!object) return new Response(null, { status: 404 });
  const headers = new Headers({ "Cache-Control": "public, max-age=3600" });
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  return new Response(object.body, { headers });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const user = await currentUser(request), { DB: db, MEDIA: bucket } = runtime();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  if (!db || !bucket) return Response.json({ error: "头像存储暂不可用" }, { status: 503 });
  const data = await request.formData(), file = data.get("avatar");
  if (!(file instanceof File)) return Response.json({ error: "请选择头像" }, { status: 400 });
  const extension = allowed.get(file.type);
  if (!extension) return Response.json({ error: "头像只支持 JPG、PNG 或 WebP" }, { status: 400 });
  if (file.size > 3 * 1024 * 1024) return Response.json({ error: "头像不能超过 3MB" }, { status: 400 });
  const handle = await ensureHandleForUser(db, user), key = `avatars/${user.id}/${crypto.randomUUID()}.${extension}`;
  await bucket.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  await db.prepare("UPDATE users SET avatar_key=? WHERE id=?").bind(key, user.id).run();
  return Response.json({ avatarUrl: `/api/creator/avatar?handle=${encodeURIComponent(handle)}&v=${Date.now()}` });
}
