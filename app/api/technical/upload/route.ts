import { ensureStorage, cleanupExpired, reserve, release, readBounded, QuotaError, type UploadReservation } from "../../../lib/storage-quota";
import { currentUser, runtime, sameOrigin } from "../../../lib/auth";
import { allowedTechnicalName, TECHNICAL_MAX_SIZE } from "../../../lib/technical";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({error:"请求来源无效"},{status:403});
  const user = await currentUser(request);
  if (!user) return Response.json({error:"请先登录"},{status:401});
  const {DB:db,MEDIA:bucket} = runtime();
  if (!db || !bucket) return Response.json({error:"资料存储暂不可用"},{status:503});
  if (Number(request.headers.get("Content-Length") || 0) > TECHNICAL_MAX_SIZE + 65536) return Response.json({error:"每份资料最多 10MB"},{status:413});
  let form: FormData;
  try { form = await new Response(await readBounded(request,TECHNICAL_MAX_SIZE+65536),{headers:{"Content-Type":request.headers.get("Content-Type")||""}}).formData(); } catch { return Response.json({error:"文件格式不正确"},{status:400}); }
  const id = Number(form.get("creationId")), file = form.get("file");
  if (!Number.isSafeInteger(id) || id <= 0 || !(file instanceof File) || !file.size || file.size > TECHNICAL_MAX_SIZE || !allowedTechnicalName(file.name) || file.name.length > 200) return Response.json({error:"请选择 10MB 以内的文档、脚本或 ZIP 文件"},{status:400});
  const product = await db.prepare("SELECT id FROM creations WHERE id=? AND creator_id=? AND visibility IN ('draft','private_pending')").bind(id,user.id).first();
  if (!product) return Response.json({error:"只有尚未完成发布的自己的产品可以上传资料"},{status:409});
  try{await ensureStorage(db,bucket);await cleanupExpired(db,bucket);}catch{return Response.json({error:"正在核对存储空间，请稍后重试"},{status:503});}
  const key = `technical/${user.id}/${id}/${crypto.randomUUID()}`;
  const name = file.name.replace(/[\\/\r\n\x00-\x1f]/g,"_");
  try {await reserve(db,{key,owner:user.id,creationId:id,size:file.size,kind:"technical",mime:"application/octet-stream"});}
  catch(error){if(error instanceof QuotaError)return Response.json({error:error.message},{status:413});throw error;}
  try {
    await bucket.put(key, await file.arrayBuffer(), {httpMetadata:{contentType:"application/octet-stream"}});
    const inserted = await db.prepare("INSERT INTO creation_technical_files(object_key,creation_id,name,size) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM creation_technical_files WHERE creation_id=?) < 5 AND EXISTS(SELECT 1 FROM creations WHERE id=? AND creator_id=? AND visibility IN ('draft','private_pending')) AND EXISTS(SELECT 1 FROM storage_objects WHERE object_key=? AND state='reserved')").bind(key,id,name,file.size,id,id,user.id,key).run();
    if (!inserted.meta.changes) {
      const row=await db.prepare("SELECT * FROM storage_objects WHERE object_key=?").bind(key).first<UploadReservation>();
      if(row)await release(db,bucket,row);else await bucket.delete(key);
      return Response.json({error:"最多上传 5 份资料，或产品已经完成发布"},{status:409});
    }
    await db.prepare("UPDATE storage_objects SET state='stored',expires_at=0 WHERE object_key=?").bind(key).run();
  } catch (error) {
    await db.prepare("DELETE FROM creation_technical_files WHERE object_key=?").bind(key).run();
    const row=await db.prepare("SELECT * FROM storage_objects WHERE object_key=?").bind(key).first<UploadReservation>();
    try{if(row)await release(db,bucket,row);else await bucket.delete(key);}catch{}
    return Response.json({error:"资料上传未完成，请稍后重试"},{status:503});
  }
  return Response.json({object_key:key,name,size:file.size},{status:201});
}
