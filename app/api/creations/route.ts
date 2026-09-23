import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { creations } from "../../../db/schema";
import { currentUser, runtime } from "../../lib/auth";
import { createCreationVersion, ensureCreationTables, parseTags } from "../../lib/creations";

export async function GET(request: Request) {
  const db = runtime().DB, slug = new URL(request.url).searchParams.get("slug");
  if (!db) return Response.json([]);
  await ensureCreationTables(db);
  const mediaSql = "SELECT id,object_key,media_type,mime_type,size,sort_order FROM creation_media WHERE creation_id=? ORDER BY sort_order";
  if (slug) {
    const work = await db.prepare("SELECT id,slug,title,description,type,status,story,tags,product_url,creator_name,created_at,updated_at FROM creations WHERE slug=? AND visibility='published'").bind(slug).first<Record<string,unknown>>();
    if (!work) return Response.json({ error: "作品不存在" }, { status: 404 });
    const media = await db.prepare(mediaSql).bind(work.id).all().then(x=>x.results).catch(()=>[]);
    return Response.json({ ...work, media });
  }
  const rows = await db.prepare("SELECT id,slug,title,description,type,status,tags,product_url,creator_name,created_at,updated_at FROM creations WHERE visibility='published' ORDER BY created_at DESC").all();
  const enriched = await Promise.all(rows.results.map(async (work) => ({ ...work, media: await db.prepare(mediaSql).bind(work.id).all().then(x=>x.results).catch(()=>[]) })));
  return Response.json(enriched);
}

export async function POST(request: Request) {
  if (request.headers.get("Origin") !== new URL(request.url).origin) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const user = await currentUser(request);
  if (!user) return Response.json({ error: "请先登录后再发布作品" }, { status: 401 });
  const db = getDb();
  await ensureCreationTables(runtime().DB!);
  const body = await request.json() as { title?: string; description?: string; type?: string; status?: string; story?: string; tags?: string; productUrl?: string; changeNote?: string; mediaCount?: number };
  if (!body.title?.trim() || !body.description?.trim() || !body.type?.trim()) {
    return Response.json({ error: "作品名称、介绍和类型不能为空" }, { status: 400 });
  }

  const existing = await db.select({ id: creations.id }).from(creations).where(eq(creations.title, body.title.trim())).limit(1);
  if (existing.length) return Response.json({ error: "这个作品已经发布过了" }, { status: 409 });

  const slug = `${body.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
  const [creation] = await db.insert(creations).values({
    slug, title: body.title.trim(), description: body.description.trim(), type: body.type,
    status: body.status || "早期测试", story: body.story || "", tags: parseTags(body.tags), productUrl: body.productUrl?.trim() || "", creatorId: user.id,
    creatorName: user.displayName,
    visibility: body.mediaCount ? "draft" : "published",
  }).returning();
  if (!body.mediaCount) await createCreationVersion(runtime().DB!, creation.id, user.id, body.changeNote || "首次发布");
  return Response.json(creation, { status: 201 });
}
