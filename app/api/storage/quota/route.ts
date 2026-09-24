import { currentUser,runtime } from "../../../lib/auth";
import { ensureStorage,cleanupExpired,quota } from "../../../lib/storage-quota";
export async function GET(request:Request) {
  const user=await currentUser(request),{DB:db,MEDIA:bucket}=runtime();
  if(!user)return Response.json({error:"请先登录"},{status:401});
  if(!db||!bucket)return Response.json({error:"上传存储暂不可用"},{status:503});
  try{await ensureStorage(db,bucket);await cleanupExpired(db,bucket);}catch{return Response.json({error:"正在核对存储空间，请稍后重试"},{status:503});}
  return Response.json(await quota(db,user.id),{headers:{"Cache-Control":"private, no-store"}});
}
