import { runtime, sameOrigin } from "../../../lib/auth";
import { ensureCreationTables } from "../../../lib/creations";
import { countInteraction, engagementTotals, interactionIdentity, validRequestId } from "../../../lib/engagement";
import { visitorJson } from "../../../lib/visitor-identity";

export async function GET(request: Request) {
  const db = runtime().DB, id = Number(new URL(request.url).searchParams.get("creationId"));
  if (!db || !id) return Response.json({ count:0, liked:false });
  await ensureCreationTables(db);
  const product = await db.prepare("SELECT id,creator_id FROM creations WHERE id=? AND visibility='published'").bind(id).first<{id:number;creator_id:string}>();
  if (!product) return Response.json({error:"产品不存在"},{status:404});
  const identity = await interactionIdentity(request,db), totals = await engagementTotals(db,id);
  const liked = await db.prepare("SELECT id FROM creation_likes WHERE creation_id=? AND user_id=?").bind(id,identity.actor).first();
  const prior = await db.prepare("SELECT id FROM creation_events WHERE creation_id=? AND actor_id=? AND event_type='liked' LIMIT 1").bind(id,identity.actor).first();
  return visitorJson(request,identity.visitorId,{count:totals.likes,liked:Boolean(liked),selfInteractionLimited:identity.user?.id===product.creator_id&&!identity.owner,selfLikeUsed:Boolean(prior)});
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({error:"请求来源无效"},{status:403});
  const db=runtime().DB;
  if (!db) return Response.json({error:"数据库暂不可用"},{status:503});
  const body=await request.json() as {creationId?:number;requestId?:string};
  if (!body.creationId || !validRequestId(body.requestId)) return Response.json({error:"操作信息不正确，请刷新页面重试"},{status:400});
  await ensureCreationTables(db);
  const product=await db.prepare("SELECT id,creator_id FROM creations WHERE id=? AND visibility='published'").bind(body.creationId).first<{id:number;creator_id:string}>();
  if (!product) return Response.json({error:"产品不存在"},{status:404});
  const identity=await interactionIdentity(request,db);
  const result=await countInteraction(db,product,identity,"liked",body.requestId);
  const totals=await engagementTotals(db,product.id);
  return visitorJson(request,identity.visitorId,{count:totals.likes,liked:true,...result});
}
