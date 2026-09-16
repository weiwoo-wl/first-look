import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { creations, sessions } from "../../../db/schema";

async function getSession(request: Request) {
  const match = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)first_look_session=([a-f0-9-]{36})(?:;|$)/);
  if (!match) return null;
  const [session] = await getDb().select().from(sessions).where(eq(sessions.id, decodeURIComponent(match[1]))).limit(1);
  if (!session || new Date(session.expiresAt) <= new Date()) return null;
  return session;
}

export async function GET() {
  const db = getDb();
  const rows = await db.select().from(creations).where(eq(creations.visibility, "published")).orderBy(desc(creations.createdAt));
  return Response.json(rows);
}

export async function POST(request: Request) {
  if (request.headers.get("Origin") !== new URL(request.url).origin) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const user = await getSession(request);
  if (!user) return Response.json({ error: "请先登录后再发布作品" }, { status: 401 });
  const db = getDb();
  const body = await request.json() as { title?: string; description?: string; type?: string; status?: string; story?: string; mediaKey?: string; mediaType?: string };
  if (!body.title?.trim() || !body.description?.trim() || !body.type?.trim()) {
    return Response.json({ error: "作品名称、介绍和类型不能为空" }, { status: 400 });
  }

  const existing = await db.select({ id: creations.id }).from(creations).where(eq(creations.title, body.title.trim())).limit(1);
  if (existing.length) return Response.json({ error: "这个作品已经发布过了" }, { status: 409 });

  const slug = `${body.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
  const [creation] = await db.insert(creations).values({
    slug, title: body.title.trim(), description: body.description.trim(), type: body.type,
    status: body.status || "早期测试", story: body.story || "", creatorId: user.githubId,
    creatorName: user.displayName, mediaKey: body.mediaKey, mediaType: body.mediaType,
    visibility: "published",
  }).returning();
  return Response.json(creation, { status: 201 });
}
