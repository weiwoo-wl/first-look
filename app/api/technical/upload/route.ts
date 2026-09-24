import { currentUser, runtime, sameOrigin } from "../../../lib/auth";
import { ensureCreationTables } from "../../../lib/creations";
import { allowedTechnicalName, TECHNICAL_MAX_SIZE } from "../../../lib/technical";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({error:"请求来源无效"},{status:403});
  const user = await currentUser(request);
  if (!user) return Response.json({error:"请先登录"},{status:401});
  const {DB:db,MEDIA:bucket} = runtime();
  if (!db || !bucket) return Response.json({error:"资料存储暂不可用"},{status:503});
  if (Number(request.headers.get("Content-Length") || 0) > TECHNICAL_MAX_SIZE + 65536) return Response.json({error:"每份资料最多 10MB"},{status:413});
  let form: FormData;
  try { form = await request.formData(); } catch { return Response.json({error:"文件格式不正确"},{status:400}); }
  const id = Number(form.get("creationId")), file = form.get("file");
  if (!Number.isSafeInteger(id) || id <= 0 || !(file instanceof File) || !file.size || file.size > TECHNICAL_MAX_SIZE || !allowedTechnicalName(file.name) || file.name.length > 200) return Response.json({error:"请选择 10MB 以内的文档、脚本或 ZIP 文件"},{status:400});
  const product = await db.prepare("SELECT id FROM creations WHERE id=? AND creator_id=? AND visibility IN ('draft','private_pending')").bind(id,user.id).first();
  if (!product) return Response.json({error:"只有尚未完成发布的自己的产品可以上传资料"},{status:409});
  await ensureCreationTables(db);
  const key = `technical/${user.id}/${id}/${crypto.randomUUID()}`;
  const name = file.name.replace(/[\\/\r\n\x00-\x1f]/g,"_");
  await bucket.put(key, await file.arrayBuffer(), {httpMetadata:{contentType:"application/octet-stream"}});
  try {
    const inserted = await db.prepare("INSERT INTO creation_technical_files(object_key,creation_id,name,size) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM creation_technical_files WHERE creation_id=?) < 5 AND EXISTS(SELECT 1 FROM creations WHERE id=? AND creator_id=? AND visibility IN ('draft','private_pending'))").bind(key,id,name,file.size,id,id,user.id).run();
    if (!inserted.meta.changes) {
      await bucket.delete(key);
      return Response.json({error:"最多上传 5 份资料，或产品已经完成发布"},{status:409});
    }
  } catch (error) { await bucket.delete(key); throw error; }
  return Response.json({object_key:key,name,size:file.size},{status:201});
}
