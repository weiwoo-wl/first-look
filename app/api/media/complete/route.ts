import {currentUser,runtime,sameOrigin} from "../../../lib/auth";
import {createCreationVersion} from "../../../lib/creations";
import {ensureStorage,type UploadReservation} from "../../../lib/storage-quota";
import {UPLOAD_LIMITS} from "../../../lib/upload-limits";
type Upload={key:string;uploadId:string;parts:R2UploadedPart[]};
export async function POST(request:Request) {
  if(!sameOrigin(request))return Response.json({error:"请求来源无效"},{status:403});
  const user=await currentUser(request),{DB:db,MEDIA:bucket}=runtime();
  if(!user)return Response.json({error:"请先登录"},{status:401});
  if(!db||!bucket)return Response.json({error:"媒体存储尚未配置"},{status:503});
  const body=await request.json() as {creationId:number;uploads:Upload[]};
  if(!Number.isSafeInteger(body.creationId)||!Array.isArray(body.uploads)||body.uploads.length>8||body.uploads.some(x=>!x||typeof x.key!=="string")||new Set(body.uploads.map(x=>x.key)).size!==body.uploads.length)return Response.json({error:"媒体数量或信息不正确"},{status:400});
  await ensureStorage(db);
  const product=await db.prepare("SELECT visibility FROM creations WHERE id=? AND creator_id=? AND visibility IN ('draft','private_pending')").bind(body.creationId,user.id).first<{visibility:string}>();
  if(!product)return Response.json({error:"已发布产品不能修改"},{status:409});
  const reserved=await db.prepare("SELECT * FROM storage_objects WHERE creation_id=? AND owner_id=? AND kind='media'").bind(body.creationId,user.id).all<UploadReservation>();
  if(reserved.results.length!==body.uploads.length)return Response.json({error:"还有未完成的媒体上传，请重试"},{status:409});
  const rows=new Map(reserved.results.map(row=>[row.object_key,row]));
  const parts=new Map<string,R2UploadedPart[]>();
  for(const upload of body.uploads) {
    const row=rows.get(upload.key);
    if(!row||row.upload_id!==upload.uploadId||!["reserved","stored"].includes(row.state))return Response.json({error:"上传信息已失效"},{status:409});
    if(row.state==="stored")continue;
    const saved=await db.prepare("SELECT part_number,etag,size FROM storage_parts WHERE object_key=? ORDER BY part_number").bind(upload.key).all<{part_number:number;etag:string;size:number}>();
    if(saved.results.length!==Math.ceil(row.size/UPLOAD_LIMITS.part)||saved.results.reduce((sum,p)=>sum+p.size,0)!==row.size||saved.results.some((p,i)=>p.part_number!==i+1))return Response.json({error:"文件还未完整上传"},{status:409});
    parts.set(upload.key,saved.results.map(p=>({partNumber:p.part_number,etag:p.etag})));
  }
  const visibility=product.visibility==="private_pending"?"private":"published";
  const claim=await db.prepare("UPDATE creations SET visibility='finalizing' WHERE id=? AND creator_id=? AND visibility=? AND (SELECT COUNT(*) FROM storage_objects WHERE creation_id=? AND kind='media')=? AND NOT EXISTS(SELECT 1 FROM storage_objects WHERE creation_id=? AND ((kind='technical' AND state!='stored') OR state='cleaning'))").bind(body.creationId,user.id,product.visibility,body.creationId,body.uploads.length,body.creationId).run();
  if(!claim.meta.changes)return Response.json({error:"上传仍在进行或作品正在保存，请稍后重试"},{status:409});
  try {
    for(const upload of body.uploads) {
      const row=rows.get(upload.key)!;
      if(row.state!=="stored") {
        let object=await bucket.head(upload.key);
        if(!object){await bucket.resumeMultipartUpload(upload.key,upload.uploadId).complete(parts.get(upload.key)!);object=await bucket.head(upload.key);}
        if(!object||object.size!==row.size)throw Error("文件实际大小校验失败");
        await db.prepare("UPDATE storage_objects SET state='stored',expires_at=0 WHERE object_key=?").bind(upload.key).run();
      }
    }
    const statements=body.uploads.map((upload,index)=>{const row=rows.get(upload.key)!;return db.prepare("INSERT OR IGNORE INTO creation_media(creation_id,object_key,media_type,mime_type,size,sort_order) VALUES(?,?,?,?,?,?)").bind(body.creationId,upload.key,row.mime.startsWith("video/")?"video":"image",row.mime,row.size,index);});
    if(statements.length)await db.batch(statements);
    await createCreationVersion(db,body.creationId,user.id,"首次发布");
    await db.prepare("UPDATE creations SET visibility=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND creator_id=? AND visibility='finalizing'").bind(visibility,body.creationId,user.id).run();
    return Response.json({ok:true,visibility});
  } catch(error) {
    console.error("[media/complete]",error);
    await db.prepare("UPDATE creations SET visibility=? WHERE id=? AND creator_id=? AND visibility='finalizing'").bind(product.visibility,body.creationId,user.id).run();
    return Response.json({error:"保存未完成，已上传文件仍计入空间，请稍后重试"},{status:500});
  }
}
