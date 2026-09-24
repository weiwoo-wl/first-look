import {currentUser,runtime,sameOrigin} from "../../../lib/auth";
import {ensureStorage,cleanupExpired,reserve,release,QuotaError,type UploadReservation} from "../../../lib/storage-quota";
const allowed=new Set(["image/jpeg","image/png","image/webp","image/gif","video/mp4","video/webm","video/quicktime"]);
export async function POST(request:Request) {
  if(!sameOrigin(request))return Response.json({error:"请求来源无效"},{status:403});
  const user=await currentUser(request),{DB:db,MEDIA:bucket}=runtime();
  if(!user)return Response.json({error:"请先登录"},{status:401});
  if(!db||!bucket)return Response.json({error:"媒体存储尚未配置"},{status:503});
  const body=await request.json() as {creationId:number;type:string;size:number};
  if(!Number.isSafeInteger(body.creationId)||!allowed.has(body.type)||!Number.isSafeInteger(body.size))return Response.json({error:"文件类型或大小不符合要求"},{status:400});
  try{await ensureStorage(db,bucket);await cleanupExpired(db,bucket);}catch{return Response.json({error:"正在核对存储空间，请稍后重试"},{status:503});}
  const key=`users/${user.id}/creations/${body.creationId}/${crypto.randomUUID()}`;
  try {await reserve(db,{key,owner:user.id,creationId:body.creationId,size:body.size,kind:"media",mime:body.type});}
  catch(error){if(error instanceof QuotaError)return Response.json({error:error.message},{status:413});throw error;}
  try {
    const upload=await bucket.createMultipartUpload(key,{httpMetadata:{contentType:body.type}});
    const saved=await db.prepare("UPDATE storage_objects SET upload_id=? WHERE object_key=? AND state='reserved'").bind(upload.uploadId,key).run();
    if(!saved.meta.changes){await upload.abort();throw Error("上传已取消");}
    return Response.json({key,uploadId:upload.uploadId});
  } catch(error) {
    const row=await db.prepare("SELECT * FROM storage_objects WHERE object_key=?").bind(key).first<UploadReservation>();
    if(row)try{await release(db,bucket,row);}catch{}
    return Response.json({error:"无法开始上传，请稍后重试"},{status:503});
  }
}
