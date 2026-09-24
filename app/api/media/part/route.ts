import {currentUser,runtime,sameOrigin} from "../../../lib/auth";
import {readBounded,type UploadReservation} from "../../../lib/storage-quota";
import {UPLOAD_LIMITS} from "../../../lib/upload-limits";
export async function PUT(request:Request) {
  if(!sameOrigin(request))return new Response(null,{status:403});
  const user=await currentUser(request),{DB:db,MEDIA:bucket}=runtime(),q=new URL(request.url).searchParams;
  if(!user)return new Response(null,{status:401});
  if(!db||!bucket)return new Response(null,{status:503});
  const key=q.get("key"),uploadId=q.get("uploadId"),id=Number(q.get("creationId")),part=Number(q.get("part"));
  if(!key||!uploadId||!Number.isSafeInteger(part)||part<1)return new Response(null,{status:400});
  const row=await db.prepare("SELECT s.* FROM storage_objects s JOIN creations c ON c.id=s.creation_id WHERE s.object_key=? AND s.creation_id=? AND s.owner_id=? AND s.upload_id=? AND s.state='reserved' AND s.expires_at>? AND c.visibility IN ('draft','private_pending')").bind(key,id,user.id,uploadId,Date.now()).first<UploadReservation>();
  if(!row||part>Math.ceil(row.size/UPLOAD_LIMITS.part))return Response.json({error:"上传已失效或分片超出范围"},{status:409});
  const expected=Math.min(UPLOAD_LIMITS.part,row.size-(part-1)*UPLOAD_LIMITS.part);
  if(request.headers.has("Content-Length")&&Number(request.headers.get("Content-Length"))!==expected)return Response.json({error:"文件实际大小与声明不一致"},{status:413});
  let bytes:Uint8Array;
  try{bytes=await readBounded(request,expected);}catch{return Response.json({error:"上传分片超出大小限制"},{status:413});}
  if(bytes.byteLength!==expected)return Response.json({error:"上传分片不完整"},{status:400});
  const uploaded=await bucket.resumeMultipartUpload(key,uploadId).uploadPart(part,bytes);
  await db.prepare("INSERT INTO storage_parts(object_key,part_number,etag,size) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM storage_objects WHERE object_key=? AND state='reserved') ON CONFLICT(object_key,part_number) DO UPDATE SET etag=excluded.etag,size=excluded.size").bind(key,part,uploaded.etag,bytes.byteLength,key).run();
  return Response.json({partNumber:uploaded.partNumber,etag:uploaded.etag});
}
