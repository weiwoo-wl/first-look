import { ensureCreationTables } from "./creations";
import { UPLOAD_LIMITS, type StorageQuota } from "./upload-limits";

export type UploadReservation = { object_key: string; owner_id: string; creation_id: number; size: number; kind: string; mime: string; upload_id: string | null; state: string; expires_at: number };
export class QuotaError extends Error {}
export async function ensureStorage(db: D1Database, bucket?: R2Bucket) {
  await ensureCreationTables(db);
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS storage_inventory (id INTEGER PRIMARY KEY,cursor TEXT NOT NULL DEFAULT '',done INTEGER NOT NULL DEFAULT 0,lease_until INTEGER NOT NULL DEFAULT 0,token TEXT NOT NULL DEFAULT '')"),
    db.prepare("CREATE TABLE IF NOT EXISTS storage_objects (object_key TEXT PRIMARY KEY,owner_id TEXT NOT NULL,creation_id INTEGER NOT NULL,size INTEGER NOT NULL CHECK(size>0),kind TEXT NOT NULL,mime TEXT NOT NULL DEFAULT '',upload_id TEXT,state TEXT NOT NULL DEFAULT 'reserved',expires_at INTEGER NOT NULL DEFAULT 0)"),
    db.prepare("CREATE INDEX IF NOT EXISTS storage_owner ON storage_objects(owner_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS storage_creation ON storage_objects(creation_id)"),
    db.prepare("CREATE TABLE IF NOT EXISTS storage_parts (object_key TEXT NOT NULL,part_number INTEGER NOT NULL,etag TEXT NOT NULL,size INTEGER NOT NULL,PRIMARY KEY(object_key,part_number))"),
  ]);
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO storage_objects(object_key,owner_id,creation_id,size,kind,mime,state) SELECT m.object_key,c.creator_id,c.id,m.size,'media',m.mime_type,'stored' FROM creation_media m JOIN creations c ON c.id=m.creation_id WHERE m.size>0"),
    db.prepare("INSERT OR IGNORE INTO storage_objects(object_key,owner_id,creation_id,size,kind,state) SELECT object_key,c.creator_id,c.id,f.size,'technical','stored' FROM creation_technical_files f JOIN creations c ON c.id=f.creation_id WHERE f.size>0"),
    db.prepare("INSERT OR IGNORE INTO storage_objects(object_key,owner_id,creation_id,size,kind,mime,state) SELECT json_extract(j.value,'$.object_key'),v.creator_id,v.creation_id,json_extract(j.value,'$.size'),'media',COALESCE(json_extract(j.value,'$.mime_type'),''),'stored' FROM creation_versions v,json_each(v.media_json) j WHERE json_extract(j.value,'$.size')>0 AND json_extract(j.value,'$.object_key') IS NOT NULL"),
    db.prepare("INSERT OR IGNORE INTO storage_objects(object_key,owner_id,creation_id,size,kind,state) SELECT json_extract(j.value,'$.object_key'),v.creator_id,v.creation_id,json_extract(j.value,'$.size'),'technical','stored' FROM creation_version_technical t JOIN creation_versions v ON v.id=t.version_id,json_each(t.data_json,'$.files') j WHERE json_extract(j.value,'$.size')>0 AND json_extract(j.value,'$.object_key') IS NOT NULL"),
  ]);
  if(bucket)await reconcileExistingObjects(db,bucket);
}
async function reconcileExistingObjects(db:D1Database,bucket:R2Bucket) {
  await db.prepare("INSERT OR IGNORE INTO storage_inventory(id) VALUES(1)").run();
  const state=await db.prepare("SELECT cursor,done FROM storage_inventory WHERE id=1").first<{cursor:string;done:number}>();
  if(state?.done)return;
  const token=crypto.randomUUID();
  const lock=await db.prepare("UPDATE storage_inventory SET token=?,lease_until=? WHERE id=1 AND done=0 AND lease_until<?").bind(token,Date.now()+60000,Date.now()).run();
  if(!lock.meta.changes)throw new QuotaError("正在核对已有存储空间，请稍后重试");
  try {
    let cursor=state?.cursor||undefined;
    for(let page=0;page<5;page++){
      const listing=await bucket.list({limit:1000,cursor});
      const entries=listing.objects.filter(o=>o.size>0).map(o=>{
        const parts=o.key.split("/");
        const owner=parts[0]==="users"||parts[0]==="technical"?parts[1]:"__unattributed__";
        const id=Number(parts[0]==="users"?parts[3]:parts[2]);
        return {key:o.key,owner:owner||"__unattributed__",id:Number.isSafeInteger(id)?id:0,size:o.size,kind:parts[0]==="technical"?"technical":"media"};
      });
      if(entries.length)await db.prepare("INSERT INTO storage_objects(object_key,owner_id,creation_id,size,kind,state) SELECT json_extract(value,'$.key'),json_extract(value,'$.owner'),json_extract(value,'$.id'),json_extract(value,'$.size'),json_extract(value,'$.kind'),'stored' FROM json_each(?) WHERE true ON CONFLICT(object_key) DO UPDATE SET size=excluded.size WHERE storage_objects.state='stored'").bind(JSON.stringify(entries)).run();
      cursor=listing.truncated?listing.cursor:undefined;
      await db.prepare("UPDATE storage_inventory SET cursor=?,done=?,lease_until=? WHERE id=1 AND token=?").bind(cursor||"",listing.truncated?0:1,Date.now()+60000,token).run();
      if(!listing.truncated)return;
    }
    throw new QuotaError("正在核对已有存储空间，请稍后重试");
  } finally {await db.prepare("UPDATE storage_inventory SET lease_until=0 WHERE id=1 AND token=?").bind(token).run();}
}

export async function quota(db: D1Database, owner: string): Promise<StorageQuota> {
  const row = await db.prepare("SELECT COALESCE(SUM(CASE WHEN owner_id=? THEN size ELSE 0 END),0) AS used,COALESCE(SUM(size),0) AS total FROM storage_objects").bind(owner).first<{used:number;total:number}>();
  return {used:row?.used || 0,limit:UPLOAD_LIMITS.account,remaining:Math.max(0,UPLOAD_LIMITS.account-(row?.used||0)),siteRemaining:Math.max(0,UPLOAD_LIMITS.site-(row?.total||0)),productLimit:UPLOAD_LIMITS.product};
}
export async function reserve(db: D1Database, data: {key:string;owner:string;creationId:number;size:number;kind:"media"|"technical";mime:string}) {
  const {key,owner,creationId,size,kind,mime}=data;
  if (!Number.isSafeInteger(size)||size<=0||size>(kind==="technical"?UPLOAD_LIMITS.technical:mime.startsWith("image/")?UPLOAD_LIMITS.image:UPLOAD_LIMITS.video)) throw new QuotaError("文件超出大小限制");
  const result=await db.prepare("INSERT INTO storage_objects(object_key,owner_id,creation_id,size,kind,mime,expires_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM creations WHERE id=? AND creator_id=? AND visibility IN ('draft','private_pending')) AND COALESCE((SELECT SUM(size) FROM storage_objects),0)+?<=? AND COALESCE((SELECT SUM(size) FROM storage_objects WHERE owner_id=?),0)+?<=? AND COALESCE((SELECT SUM(size) FROM storage_objects WHERE creation_id=?),0)+?<=? AND (SELECT COUNT(*) FROM storage_objects WHERE creation_id=? AND kind=?)<?").bind(key,owner,creationId,size,kind,mime,Date.now()+24*60*60*1000,creationId,owner,size,UPLOAD_LIMITS.site,owner,size,UPLOAD_LIMITS.account,creationId,size,UPLOAD_LIMITS.product,creationId,kind,kind==="media"?8:5).run();
  if (!result.meta.changes) {
    const usage=await quota(db,owner);
    if (usage.siteRemaining<size) throw new QuotaError("全站上传空间已达上限，暂时无法新增文件");
    if (usage.remaining<size) throw new QuotaError("账号已达 300MB 空间上限，请删除不需要的产品后重试");
    throw new QuotaError("本次发布合计最多 100MB、8 个图片视频和 5 份资料，或作品已完成发布");
  }
}
export async function release(db:D1Database,bucket:R2Bucket,row:UploadReservation) {
  if (row.upload_id && row.state!=="stored" && !await bucket.head(row.object_key)) await bucket.resumeMultipartUpload(row.object_key,row.upload_id).abort();
  await bucket.delete(row.object_key);
  await db.batch([db.prepare("DELETE FROM storage_parts WHERE object_key=?").bind(row.object_key),db.prepare("DELETE FROM storage_objects WHERE object_key=?").bind(row.object_key)]);
}
export async function cleanupExpired(db:D1Database,bucket:R2Bucket) {
  const rows=await db.prepare("SELECT * FROM storage_objects WHERE state='reserved' AND expires_at<? AND NOT EXISTS(SELECT 1 FROM creations c WHERE c.id=storage_objects.creation_id AND c.visibility='finalizing') LIMIT 10").bind(Date.now()).all<UploadReservation>();
  for (const row of rows.results) {
    try {
      const claim=await db.prepare("UPDATE storage_objects SET state='cleaning' WHERE object_key=? AND state='reserved' AND expires_at<?").bind(row.object_key,Date.now()).run();
      if(claim.meta.changes) await release(db,bucket,row);
    } catch { await db.prepare("UPDATE storage_objects SET state='reserved' WHERE object_key=? AND state='cleaning'").bind(row.object_key).run(); }
  }
}
export async function readBounded(request:Request,limit:number) {
  const reader=request.body?.getReader();
  if(!reader) throw new Error("文件内容为空");
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new Error("文件实际大小超过限制");}chunks.push(value);}
  const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}return data;
}
