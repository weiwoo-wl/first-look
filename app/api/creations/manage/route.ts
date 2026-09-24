import { ensureAdminTables } from "../../../lib/admin";
import { ensureStorage, cleanupExpired, type UploadReservation } from "../../../lib/storage-quota";
import { currentUser, runtime, sameOrigin } from "../../../lib/auth";
import { ensureCreationTables, recordCreationEvent } from "../../../lib/creations";

function mediaKeys(rows: { media_json?: unknown }[]) {
  const keys = new Set<string>();
  for (const row of rows) {
    try {
      const media = JSON.parse(String(row.media_json || "[]")) as { object_key?: string }[];
      for (const item of media) if (item.object_key?.startsWith("users/")) keys.add(item.object_key);
    } catch {}
  }
  return keys;
}

export async function POST(request: Request) {
  try {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const user = await currentUser(request), { DB: db, MEDIA: bucket } = runtime();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  if (!db) return Response.json({ error: "数据库暂不可用" }, { status: 503 });
  await ensureCreationTables(db);
  const body = await request.json() as { creationId?: number; action?: "unpublish" | "republish" | "publicize" | "delete" | "toggle_contact"; contactEmailVisible?: boolean };
  if (!body.creationId || !["unpublish", "republish", "publicize", "delete", "toggle_contact"].includes(body.action || "")) return Response.json({ error: "操作信息不正确" }, { status: 400 });
  const product = await db.prepare("SELECT id,visibility,contact_email_visible FROM creations WHERE id=? AND creator_id=?").bind(body.creationId, user.id).first<{ id:number; visibility:string; contact_email_visible:number }>();
  if (!product) return Response.json({ error: "找不到这个产品" }, { status: 404 });

  if (body.action === "toggle_contact") {
    const visible = body.contactEmailVisible === true ? 1 : 0;
    await db.prepare("UPDATE creations SET contact_email_visible=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND creator_id=?").bind(visible, body.creationId, user.id).run();
    return Response.json({ ok: true, contactEmailVisible: Boolean(visible) });
  }

  if (["finalizing","deleting"].includes(product.visibility)) return Response.json({error:"作品正在保存或删除，请稍后重试"},{status:409});
  if (body.action === "delete") {
    if(!bucket)return Response.json({error:"文件存储暂不可用，请稍后再删除"},{status:503});
    try{await ensureStorage(db,bucket);await ensureAdminTables(db);await cleanupExpired(db,bucket);}catch{return Response.json({error:"正在核对存储空间，请稍后重试"},{status:503});}
    const claim=await db.prepare("UPDATE creations SET visibility='deleting' WHERE id=? AND creator_id=? AND visibility=? AND NOT EXISTS(SELECT 1 FROM storage_objects WHERE creation_id=? AND state!='stored')").bind(body.creationId,user.id,product.visibility,body.creationId).run();
    if(!claim.meta.changes)return Response.json({error:"还有上传未结束，请等待或取消上传后再删除"},{status:409});
    try {
    const stored=await db.prepare("SELECT * FROM storage_objects WHERE creation_id=?").bind(body.creationId).all<UploadReservation>();
    const currentMedia = await db.prepare("SELECT object_key FROM creation_media WHERE creation_id=?").bind(body.creationId).all<{ object_key:string }>();
    const versions = await db.prepare("SELECT media_json FROM creation_versions WHERE creation_id=?").bind(body.creationId).all<{ media_json:string }>();
    const documents = await db.prepare("SELECT object_key FROM creation_technical_files WHERE creation_id=?").bind(body.creationId).all<{object_key:string}>();
    const keys = mediaKeys(versions.results);
    for (const item of currentMedia.results) if (item.object_key?.startsWith("users/")) keys.add(item.object_key);
    for (const file of documents.results) keys.add(file.object_key);
    for(const item of stored.results)keys.add(item.object_key);
    try {for(let offset=0;offset<keys.size;offset+=100)await bucket.delete([...keys].slice(offset,offset+100));}
    catch {await db.prepare("UPDATE creations SET visibility=? WHERE id=? AND visibility='deleting'").bind(product.visibility,body.creationId).run();return Response.json({error:"文件尚未清理成功，空间暂未释放，请稍后重试"},{status:503});}
    await db.batch([
      db.prepare("DELETE FROM storage_parts WHERE object_key IN (SELECT object_key FROM storage_objects WHERE creation_id=?)").bind(body.creationId),
      db.prepare("DELETE FROM storage_objects WHERE creation_id=?").bind(body.creationId),
      db.prepare("DELETE FROM creation_version_technical WHERE version_id IN (SELECT id FROM creation_versions WHERE creation_id=?)").bind(body.creationId),
      db.prepare("DELETE FROM creation_technical_files WHERE creation_id=?").bind(body.creationId),
      db.prepare("DELETE FROM creation_technical WHERE creation_id=?").bind(body.creationId),
      db.prepare("DELETE FROM creation_likes WHERE creation_id=?").bind(body.creationId),
      db.prepare("DELETE FROM creation_favorites WHERE creation_id=?").bind(body.creationId),
      db.prepare("DELETE FROM creation_views WHERE creation_id=?").bind(body.creationId),
      db.prepare("DELETE FROM creation_shares WHERE creation_id=?").bind(body.creationId),
      db.prepare("DELETE FROM admin_hidden_creations WHERE creation_id=?").bind(body.creationId),
      db.prepare("DELETE FROM site_reports WHERE target_type='creation' AND target_id=?").bind(String(body.creationId)),
      db.prepare("DELETE FROM creation_events WHERE creation_id=?").bind(body.creationId),
      db.prepare("DELETE FROM creation_versions WHERE creation_id=?").bind(body.creationId),
      db.prepare("DELETE FROM creation_media WHERE creation_id=?").bind(body.creationId),
      db.prepare("DELETE FROM creations WHERE id=? AND creator_id=?").bind(body.creationId, user.id),
    ]);
    return Response.json({ ok: true, deleted: true });
    } finally {await db.prepare("UPDATE creations SET visibility=? WHERE id=? AND visibility=\'deleting\'").bind(product.visibility,body.creationId).run();}
  }

  if (["draft", "private_pending"].includes(product.visibility)) return Response.json({ error: "作品还没有完成发布" }, { status: 409 });
  if (body.action === "publicize" && product.visibility !== "private") return Response.json({ error: "只有仅自己可见的作品可以公开上架" }, { status: 409 });
  if (body.action === "unpublish" && product.visibility === "private") return Response.json({ error: "仅自己可见的作品尚未公开上架" }, { status: 409 });
  const visibility = body.action === "unpublish" ? "unpublished" : "published";
  if (product.visibility === visibility) return Response.json({ ok: true, visibility });
  await db.prepare("UPDATE creations SET visibility=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND creator_id=?").bind(visibility, body.creationId, user.id).run();
  const eventType = body.action === "publicize" ? "publicized" : visibility === "published" ? "republished" : "unpublished";
  const detail = body.action === "publicize" ? "产品公开上架" : visibility === "published" ? "产品重新上架" : "产品下架";
  await recordCreationEvent(db, body.creationId, user.id, eventType, detail);
  return Response.json({ ok: true, visibility });
  } catch (error) {
    console.error("[creations/manage]", error);
    return Response.json({error:"服务器暂时无法完成操作，请稍后重试"},{status:500});
  }
}
