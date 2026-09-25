import { normalizeTechnical, readTechnical } from "../../lib/technical";
import { eq } from "drizzle-orm";
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
    const work = await db.prepare("SELECT c.id,c.slug,c.title,c.description,c.type,c.status,c.story,c.tags,c.product_url,c.creator_name,c.created_at,c.updated_at,CASE WHEN c.contact_email_visible=1 THEN u.email ELSE NULL END AS contact_email FROM creations c LEFT JOIN users u ON u.id=c.creator_id WHERE c.slug=? AND c.visibility='published'").bind(slug).first<Record<string,unknown>>();
    if (!work) return Response.json({ error: "作品不存在" }, { status: 404 });
    const media = await db.prepare(mediaSql).bind(work.id).all().then(x=>x.results).catch(()=>[]);
    return Response.json({ ...work, media, technical: await readTechnical(db,Number(work.id)) });
  }
  const rows = await db.prepare("SELECT c.id,c.slug,c.title,c.description,c.type,c.status,c.tags,c.product_url,c.creator_name,c.created_at,c.updated_at,(SELECT COUNT(*) FROM creation_likes l WHERE l.creation_id=c.id) AS likes,(SELECT COUNT(*) FROM creation_favorites f WHERE f.creation_id=c.id) AS favorites,(SELECT COUNT(*) FROM creation_shares s WHERE s.creation_id=c.id) AS shares,(SELECT COUNT(*) FROM creation_views v WHERE v.creation_id=c.id) AS views FROM creations c WHERE c.visibility='published' ORDER BY c.created_at DESC").all();
  const enriched = await Promise.all(rows.results.map(async (work) => ({ ...work, media: await db.prepare(mediaSql).bind(work.id).all().then(x=>x.results).catch(()=>[]) })));
  return Response.json(enriched);
}

async function postCreation(request: Request) {
  if (request.headers.get("Origin") !== new URL(request.url).origin) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const user = await currentUser(request);
  if (!user) return Response.json({ error: "请先登录后再发布作品" }, { status: 401 });
  const db = getDb();
  await ensureCreationTables(runtime().DB!);
  const body = await request.json() as { title?: string; description?: string; type?: string; status?: string; story?: string; tags?: string; productUrl?: string; changeNote?: string; mediaCount?: number; technical?: unknown; attachmentCount?: number; visibility?: "published" | "private"; contactEmailVisible?: boolean };
  const title = body.title?.trim() || "", description = body.description?.trim() || "", type = body.type?.trim() || "";
  if (!title || !description || !type) return Response.json({ error: "作品名称、介绍和类型不能为空" }, { status: 400 });
  if (title.length < 2 || title.length > 80) return Response.json({ error: "作品名称需要为 2 到 80 个字" }, { status: 400 });
  if (description.length < 10 || description.length > 500) return Response.json({ error: "一句话介绍需要为 10 到 500 个字" }, { status: 400 });
  if (body.story && body.story.trim().length > 2000) return Response.json({ error: "创作故事不能超过 2000 个字" }, { status: 400 });
  if (body.productUrl && body.productUrl.trim() && !/^https?:\/\//i.test(body.productUrl.trim())) return Response.json({ error: "产品链接需要以 http:// 或 https:// 开头" }, { status: 400 });

  let technical;
  try { technical = normalizeTechnical(body.technical); }
  catch (error) { return Response.json({error: error instanceof Error ? error.message : "技术分享格式不正确"},{status:400}); }
  if (body.attachmentCount !== undefined && (!Number.isInteger(body.attachmentCount) || body.attachmentCount < 0 || body.attachmentCount > 5)) return Response.json({error:"技术资料最多 5 个"},{status:400});
  const pending = Boolean(body.mediaCount || body.attachmentCount);
  const existing = await db.select({ id: creations.id }).from(creations).where(eq(creations.title, title)).limit(1);
  if (existing.length) return Response.json({ error: "这个作品已经发布过了" }, { status: 409 });

  const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
  const [creation] = await db.insert(creations).values({
    slug, title, description, type,
    status: body.status || "早期测试", story: body.story || "", tags: parseTags(body.tags), productUrl: body.productUrl?.trim() || "", creatorId: user.id,
    creatorName: user.displayName, contactEmailVisible: body.contactEmailVisible ? 1 : 0,
    visibility: pending ? (body.visibility === "private" ? "private_pending" : "draft") : (body.visibility === "private" ? "private" : "published"),
  }).returning();
  await runtime().DB!.prepare("INSERT INTO creation_technical(creation_id,notes,links_json) VALUES(?,?,?)").bind(creation.id,technical.notes,JSON.stringify(technical.links)).run();
  if (!pending) await createCreationVersion(runtime().DB!, creation.id, user.id, body.changeNote || "首次发布");
  return Response.json(creation, { status: 201 });
}

export async function POST(request: Request) {
  try { return await postCreation(request); }
  catch (error) { console.error("[api/creations] publish failed", error); return Response.json({ error: "服务器暂时无法保存产品，请稍后再试" }, { status: 500 }); }
}
