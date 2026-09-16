import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { creations } from "../../../db/schema";

export async function GET() {
  const db = getDb();
  const rows = await db.select().from(creations).where(eq(creations.visibility, "published")).orderBy(desc(creations.createdAt));
  return Response.json(rows);
}

export async function POST(request: Request) {
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
    status: body.status || "早期测试", story: body.story || "", creatorId: "anonymous",
    creatorName: "First Look 创作者", mediaKey: body.mediaKey, mediaType: body.mediaType,
    visibility: "published",
  }).returning();
  return Response.json(creation, { status: 201 });
}
