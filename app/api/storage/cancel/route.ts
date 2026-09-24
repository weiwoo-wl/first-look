import {currentUser,runtime,sameOrigin} from "../../../lib/auth";
import {ensureStorage,release,type UploadReservation} from "../../../lib/storage-quota";
export async function POST(request:Request) {
  if(!sameOrigin(request))return new Response(null,{status:403});
  const user=await currentUser(request),{DB:db,MEDIA:bucket}=runtime();
  if(!user)return new Response(null,{status:401});
  if(!db||!bucket)return new Response(null,{status:503});
  const {creationId}=await request.json() as {creationId:number};await ensureStorage(db);
  const rows=await db.prepare("SELECT s.* FROM storage_objects s JOIN creations c ON c.id=s.creation_id WHERE s.creation_id=? AND s.owner_id=? AND s.state='reserved' AND c.visibility IN ('draft','private_pending')").bind(creationId,user.id).all<UploadReservation>();
  for(const row of rows.results) {
    const claim=await db.prepare("UPDATE storage_objects SET state='cleaning' WHERE object_key=? AND state='reserved'").bind(row.object_key).run();
    if(claim.meta.changes)try{await release(db,bucket,row);}catch{await db.prepare("UPDATE storage_objects SET state='reserved' WHERE object_key=? AND state='cleaning'").bind(row.object_key).run();}
  }
  return Response.json({ok:true});
}
