import { currentUser, runtime } from "../../../lib/auth";
export async function GET(request: Request) {
  const {DB:db,MEDIA:bucket} = runtime(), key = new URL(request.url).searchParams.get("key");
  const missing = () => new Response(null,{status:404,headers:{"Cache-Control":"private, no-store"}});
  if (!db || !bucket || !key?.startsWith("technical/")) return missing();
  const file = await db.prepare("SELECT f.name,c.creator_id,c.visibility FROM creation_technical_files f JOIN creations c ON c.id=f.creation_id WHERE f.object_key=?").bind(key).first<{name:string;creator_id:string;visibility:string}>();
  if (!file) return missing();
  if (file.visibility !== "published") {
    const user = await currentUser(request);
    if (!user || user.id !== file.creator_id) return missing();
  }
  const object = await bucket.get(key);
  if (!object) return missing();
  return new Response(object.body,{headers:{
    "Content-Type":"application/octet-stream",
    "Content-Disposition":`attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/['()*]/g, c=>"%"+c.charCodeAt(0).toString(16))}`,
    "Content-Length":String(object.size),
    "Cache-Control":"private, no-store",
    "X-Content-Type-Options":"nosniff",
    "Content-Security-Policy":"sandbox"
  }});
}
