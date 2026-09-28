import { currentUser, runtime, sameOrigin } from "../../../lib/auth";
import { ensureCreationTables, parseTags } from "../../../lib/creations";
import { normalizeResourceValue, normalizeTechnical, readTechnical, type TechnicalFile, type TechnicalLink } from "../../../lib/technical";
import { UPLOAD_LIMITS } from "../../../lib/upload-limits";
import type { UploadReservation } from "../../../lib/storage-quota";

type MediaUpload = { key: string; uploadId: string; parts: R2UploadedPart[] };
type MediaChoice = { kind: "existing" | "upload"; key: string };
const productTypes = ["工具", "小程序", "网页", "视频", "数字人", "Skill", "图片", "音频", "文本", "实验", "其他"];
const productStatuses = ["正在使用", "早期测试", "概念阶段"];
const placeholders = (values: string[]) => values.map(() => "?").join(",");

export async function GET(request: Request) {
  const user = await currentUser(request), db = runtime().DB;
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("creationId"));
  if (!db || !Number.isSafeInteger(id) || id <= 0) return Response.json({ error: "产品不存在" }, { status: 400 });
  await ensureCreationTables(db);
  const product = await db.prepare("SELECT id,slug,title,description,type,status,story,tags,product_url,visibility,updated_at,edit_lock_until FROM creations WHERE id=? AND creator_id=?").bind(id, user.id).first<Record<string, unknown>>();
  if (!product) return Response.json({ error: "找不到这个产品" }, { status: 404 });
  if (["deleting", "finalizing"].includes(String(product.visibility))) return Response.json({ error: "产品正在处理，请稍后再编辑" }, { status: 409 });
  const media = await db.prepare("SELECT object_key,media_type,mime_type,size,sort_order FROM creation_media WHERE creation_id=? ORDER BY sort_order").bind(id).all();
  return Response.json({ product, media: media.results, technical: await readTechnical(db, id) });
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const user = await currentUser(request), { DB: db, MEDIA: bucket } = runtime();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  if (!db || !bucket) return Response.json({ error: "产品编辑服务暂不可用" }, { status: 503 });

  const body = await request.json() as {
    creationId?: number; expectedUpdatedAt?: string; title?: string; description?: string; type?: string; status?: string;
    story?: string; tags?: string; productUrl?: string; changeNote?: string; technical?: unknown;
    media?: MediaChoice[]; mediaUploads?: MediaUpload[]; technicalFileKeys?: string[];
  };
  const id = Number(body.creationId);
  if (!Number.isSafeInteger(id) || id <= 0 || !body.expectedUpdatedAt || !Array.isArray(body.media) || !Array.isArray(body.mediaUploads) || !Array.isArray(body.technicalFileKeys)) return Response.json({ error: "编辑信息不完整，请刷新后重试" }, { status: 400 });
  const title = String(body.title || "").trim(), description = String(body.description || "").trim();
  const type = String(body.type || ""), status = String(body.status || "");
  const story = String(body.story || "").trim(), tags = parseTags(body.tags), productUrl = String(body.productUrl || "").trim();
  const tagItems = String(body.tags || "").split(/[，,\n]/).map((tag) => tag.trim()).filter(Boolean);
  const changeNote = String(body.changeNote || "").trim().slice(0, 240);
  if (title.length < 2 || title.length > 80) return Response.json({ error: "作品名称需要为 2 到 80 个字" }, { status: 400 });
  if (description.length < 10 || description.length > 500) return Response.json({ error: "一句话介绍需要为 10 到 500 个字" }, { status: 400 });
  if (!productTypes.includes(type) || !productStatuses.includes(status)) return Response.json({ error: "请选择有效的作品类型和当前状态" }, { status: 400 });
  if (story.length > 2000) return Response.json({ error: "创作故事不能超过 2000 个字" }, { status: 400 });
  if (tagItems.length > 8 || tagItems.some((tag) => tag.length > 40)) return Response.json({ error: "标签最多 8 个，每个不超过 40 个字" }, { status: 400 });
  if (productUrl) { try { normalizeResourceValue(productUrl); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "产品入口格式不正确" }, { status: 400 }); } }
  if (body.media.length > 8 || body.mediaUploads.length > 8 || body.technicalFileKeys.length > 5) return Response.json({ error: "最多添加 8 个图片或视频、5 份资料文件" }, { status: 400 });
  if (body.media.some((item) => !item || !["existing", "upload"].includes(item.kind) || typeof item.key !== "string") || new Set(body.media.map((item) => item.key)).size !== body.media.length || new Set(body.technicalFileKeys).size !== body.technicalFileKeys.length) return Response.json({ error: "媒体或资料清单不正确" }, { status: 400 });
  let technical: { notes: string; links: TechnicalLink[] };
  try { technical = normalizeTechnical(body.technical); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "技术分享格式不正确" }, { status: 400 }); }

  await ensureCreationTables(db);
  const product = await db.prepare("SELECT id,creator_id,title,description,type,status,story,tags,product_url,visibility,updated_at,edit_lock_until FROM creations WHERE id=? AND creator_id=?").bind(id, user.id).first<Record<string, unknown>>();
  if (!product) return Response.json({ error: "找不到这个产品" }, { status: 404 });
  if (["deleting", "finalizing"].includes(String(product.visibility))) return Response.json({ error: "产品正在处理，请稍后再试" }, { status: 409 });
  if (Number(product.edit_lock_until || 0) > Date.now()) return Response.json({ error: "产品正在保存其他修改，请稍后重试" }, { status: 409 });
  if (String(product.updated_at || "") !== body.expectedUpdatedAt) return Response.json({ error: "产品内容刚刚有更新，请刷新后再编辑" }, { status: 409 });

  const currentMedia = await db.prepare("SELECT object_key,media_type,mime_type,size,sort_order FROM creation_media WHERE creation_id=? ORDER BY sort_order").bind(id).all<{ object_key: string; media_type: string; mime_type: string; size: number; sort_order: number }>();
  const currentMediaByKey = new Map(currentMedia.results.map((item) => [item.object_key, item]));
  const currentTechnical = await readTechnical(db, id);
  const currentFiles = new Map(currentTechnical.files.map((item) => [item.object_key, item]));
  const uploadKeys = body.mediaUploads.map((item) => item?.key);
  if (uploadKeys.some((key) => typeof key !== "string") || new Set(uploadKeys).size !== uploadKeys.length) return Response.json({ error: "新媒体上传信息不正确" }, { status: 400 });
  const chosenMediaUploads = body.media.filter((item) => item.kind === "upload").map((item) => item.key);
  if (chosenMediaUploads.length !== body.mediaUploads.length || chosenMediaUploads.some((key) => !uploadKeys.includes(key))) return Response.json({ error: "请检查新上传的图片和视频" }, { status: 400 });
  if (body.media.some((item) => item.kind === "existing" && !currentMediaByKey.has(item.key))) return Response.json({ error: "产品图片清单已变化，请刷新后重试" }, { status: 409 });
  if (body.technicalFileKeys.some((key) => typeof key !== "string")) return Response.json({ error: "资料文件清单不正确" }, { status: 400 });

  const newMediaRows = uploadKeys.length ? await db.prepare(`SELECT * FROM storage_objects WHERE object_key IN (${placeholders(uploadKeys)}) AND creation_id=? AND owner_id=? AND kind='media'`).bind(...uploadKeys, id, user.id).all<UploadReservation>() : { results: [] as UploadReservation[] };
  const newMediaByKey = new Map(newMediaRows.results.map((item) => [item.object_key, item]));
  if (newMediaByKey.size !== uploadKeys.length || body.mediaUploads.some((item) => { const row = newMediaByKey.get(item.key); return !row || row.upload_id !== item.uploadId || row.state !== "reserved" || row.expires_at <= Date.now(); })) return Response.json({ error: "新上传的图片或视频已过期，请重新选择" }, { status: 409 });

  const neededTechKeys = body.technicalFileKeys.filter((key) => !currentFiles.has(key));
  const stagedTech = neededTechKeys.length ? await db.prepare(`SELECT e.object_key,e.name,e.size,e.mime,s.state,s.expires_at FROM creation_edit_uploads e JOIN storage_objects s ON s.object_key=e.object_key WHERE e.object_key IN (${placeholders(neededTechKeys)}) AND e.creation_id=? AND e.owner_id=? AND e.kind='technical'`).bind(...neededTechKeys, id, user.id).all<TechnicalFile & { mime: string; state: string; expires_at: number }>() : { results: [] as (TechnicalFile & { mime: string; state: string; expires_at: number })[] };
  const stagedTechByKey = new Map(stagedTech.results.map((item) => [item.object_key, item]));
  if (neededTechKeys.some((key) => { const row = stagedTechByKey.get(key); return !row || row.state !== "reserved" || row.expires_at <= Date.now(); })) return Response.json({ error: "新上传的资料已过期，请重新选择" }, { status: 409 });

  const mediaRows = body.media.map((item, sort_order) => {
    const existing = currentMediaByKey.get(item.key), uploaded = newMediaByKey.get(item.key);
    return existing ? { ...existing, sort_order } : { object_key: item.key, media_type: uploaded!.mime.startsWith("video/") ? "video" : "image", mime_type: uploaded!.mime, size: uploaded!.size, sort_order };
  });
  const techFiles = body.technicalFileKeys.map((key) => currentFiles.get(key) || stagedTechByKey.get(key)!);
  if (mediaRows.reduce((sum, item) => sum + item.size, 0) + techFiles.reduce((sum, item) => sum + item.size, 0) > UPLOAD_LIMITS.product) return Response.json({ error: "当前产品全部图片、视频和资料合计不能超过 100MB" }, { status: 413 });

  const nextTech = { notes: technical.notes, links: technical.links, files: techFiles };
  const currentData = { title: String(product.title), description: String(product.description), type: String(product.type), status: String(product.status), story: String(product.story || ""), tags: String(product.tags || ""), product_url: String(product.product_url || "") };
  const nextData = { title, description, type, status, story, tags, product_url: productUrl };
  const sameMedia = currentMedia.results.length === mediaRows.length && currentMedia.results.every((item, index) => item.object_key === mediaRows[index].object_key);
  const sameTechFiles = currentTechnical.files.length === techFiles.length && currentTechnical.files.every((item, index) => item.object_key === techFiles[index].object_key);
  const sameTech = currentTechnical.notes === technical.notes && JSON.stringify(currentTechnical.links) === JSON.stringify(technical.links) && sameTechFiles;
  const noChanges = Object.keys(currentData).every((key) => currentData[key as keyof typeof currentData] === nextData[key as keyof typeof nextData]) && sameMedia && sameTech && body.mediaUploads.length === 0 && neededTechKeys.length === 0;
  if (noChanges) return Response.json({ ok: true, unchanged: true, version: null });

  let lockUntil = Date.now() + 600_000;
  const lock = await db.prepare("UPDATE creations SET edit_lock_until=? WHERE id=? AND creator_id=? AND updated_at=? AND COALESCE(edit_lock_until,0)<?").bind(lockUntil, id, user.id, body.expectedUpdatedAt, Date.now()).run();
  if (!lock.meta.changes) return Response.json({ error: "产品刚刚有更新，请刷新后再保存" }, { status: 409 });

  try {
    if (body.mediaUploads.length) {
      for (const upload of body.mediaUploads) {
        const row = newMediaByKey.get(upload.key)!;
        const parts = await db.prepare("SELECT part_number,etag,size FROM storage_parts WHERE object_key=? ORDER BY part_number").bind(upload.key).all<{ part_number: number; etag: string; size: number }>();
        if (parts.results.length !== Math.ceil(row.size / UPLOAD_LIMITS.part) || parts.results.reduce((sum, part) => sum + part.size, 0) !== row.size || parts.results.some((part, index) => part.part_number !== index + 1)) throw Error("图片或视频尚未完整上传");
        let object = await bucket.head(upload.key);
        if (!object) {
          await bucket.resumeMultipartUpload(upload.key, upload.uploadId).complete(parts.results.map((part) => ({ partNumber: part.part_number, etag: part.etag })));
          object = await bucket.head(upload.key);
        }
        if (!object || object.size !== row.size) throw Error("上传文件大小校验失败");
      }
    }

    const renewedUntil = Date.now() + 600_000;
    const renewed = await db.prepare("UPDATE creations SET edit_lock_until=? WHERE id=? AND creator_id=? AND edit_lock_until=?").bind(renewedUntil, id, user.id, lockUntil).run();
    if (!renewed.meta.changes) throw Error("保存时间过长，请重新打开编辑页后再试");
    lockUntil = renewedUntil;

    const versionCount = await db.prepare("SELECT COALESCE(MAX(version_number),0) AS version FROM creation_versions WHERE creation_id=?").bind(id).first<{ version: number }>();
    const hasHistory = Number(versionCount?.version || 0) > 0;
    const version = Number(versionCount?.version || 0) + (hasHistory ? 1 : 2);
    const likes = await db.prepare("SELECT COUNT(*) AS total FROM creation_likes WHERE creation_id=?").bind(id).first<{ total: number }>();
    const mediaSnapshot = mediaRows.map(({ object_key, media_type, mime_type, size, sort_order }) => ({ object_key, media_type, mime_type, size, sort_order }));
    const timestamp = new Date().toISOString();
    const statements = [
      ...(!hasHistory ? [
        db.prepare("INSERT INTO creation_versions(creation_id,creator_id,version_number,title,description,type,status,story,tags,product_url,change_note,media_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").bind(id, user.id, 1, currentData.title, currentData.description, currentData.type, currentData.status, currentData.story, currentData.tags, currentData.product_url, "首次编辑前的历史记录", JSON.stringify(currentMedia.results)),
        db.prepare("INSERT INTO creation_version_technical(version_id,data_json) SELECT id,? FROM creation_versions WHERE creation_id=? AND version_number=1").bind(JSON.stringify(currentTechnical), id),
        db.prepare("INSERT INTO creation_events(creation_id,actor_id,event_type,version_number,likes_total,detail) VALUES(?,?,'published',1,?,?)").bind(id, user.id, Number(likes?.total || 0), "首次编辑前的历史记录"),
      ] : []),
      db.prepare("UPDATE creations SET title=?,description=?,type=?,status=?,story=?,tags=?,product_url=?,updated_at=?,edit_lock_until=0 WHERE id=? AND creator_id=? AND edit_lock_until=?").bind(title, description, type, status, story, tags, productUrl, timestamp, id, user.id, lockUntil),
      db.prepare("DELETE FROM creation_media WHERE creation_id=?").bind(id),
      ...mediaRows.map((item) => db.prepare("INSERT INTO creation_media(creation_id,object_key,media_type,mime_type,size,sort_order) VALUES(?,?,?,?,?,?)").bind(id, item.object_key, item.media_type, item.mime_type, item.size, item.sort_order)),
      db.prepare("INSERT INTO creation_technical(creation_id,notes,links_json) VALUES(?,?,?) ON CONFLICT(creation_id) DO UPDATE SET notes=excluded.notes,links_json=excluded.links_json").bind(id, technical.notes, JSON.stringify(technical.links)),
      db.prepare("DELETE FROM creation_technical_files WHERE creation_id=?").bind(id),
      ...techFiles.map((item) => db.prepare("INSERT INTO creation_technical_files(object_key,creation_id,name,size) VALUES(?,?,?,?)").bind(item.object_key, id, item.name, item.size)),
      ...[...newMediaRows.results.map((item) => item.object_key), ...stagedTech.results.map((item) => item.object_key)].map((key) => db.prepare("UPDATE storage_objects SET state='stored',expires_at=0 WHERE object_key=? AND owner_id=? AND creation_id=? AND state='reserved'").bind(key, user.id, id)),
      ...newMediaRows.results.map((item) => db.prepare("DELETE FROM storage_parts WHERE object_key=?").bind(item.object_key)),
      ...stagedTech.results.map((item) => db.prepare("DELETE FROM creation_edit_uploads WHERE object_key=? AND owner_id=?").bind(item.object_key, user.id)),
      db.prepare("INSERT INTO creation_versions(creation_id,creator_id,version_number,title,description,type,status,story,tags,product_url,change_note,media_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").bind(id, user.id, version, title, description, type, status, story, tags, productUrl, changeNote || "补充或更新产品内容", JSON.stringify(mediaSnapshot)),
      db.prepare("INSERT INTO creation_version_technical(version_id,data_json) SELECT id,? FROM creation_versions WHERE creation_id=? AND version_number=?").bind(JSON.stringify(nextTech), id, version),
      db.prepare("INSERT INTO creation_events(creation_id,actor_id,event_type,version_number,likes_total,detail) VALUES(?,?,'updated',?,?,?)").bind(id, user.id, version, Number(likes?.total || 0), changeNote || "补充或更新产品内容"),
    ];
    const result = await db.batch(statements);
    if (!result[hasHistory ? 0 : 3]?.meta.changes) throw Error("产品内容刚刚有更新，请刷新后重试");
    return Response.json({ ok: true, version, updatedAt: timestamp });
  } catch (error) {
    await db.prepare("UPDATE creations SET edit_lock_until=0 WHERE id=? AND creator_id=? AND edit_lock_until=?").bind(id, user.id, lockUntil).run().catch(() => undefined);
    console.error("[creations/update] edit failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "保存失败，请稍后重试" }, { status: 500 });
  }
}
