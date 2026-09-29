import { runtime, sameOrigin } from "../../../lib/auth";
import { ensureCreationTables } from "../../../lib/creations";
import { ensureCreatorProfileTables } from "../../../lib/creator-profile";
import { countInteraction, engagementTotals, interactionIdentity, isKnownBot, validRequestId } from "../../../lib/engagement";
import { visitorJson } from "../../../lib/visitor-identity";

export async function GET(request: Request) {
  const db=runtime().DB,id=Number(new URL(request.url).searchParams.get("creationId"));
  if (!db||!id) return Response.json({likes:0,favorites:0,shares:0,views:0,liked:false,favorited:false});
  await ensureCreationTables(db);
  await ensureCreatorProfileTables(db);
  const product=await db.prepare("SELECT c.id,c.slug,c.creator_id,CASE WHEN u.contact_enabled=1 THEN u.email ELSE NULL END AS contact_email FROM creations c LEFT JOIN users u ON u.id=c.creator_id WHERE c.id=? AND c.visibility='published'").bind(id).first<{id:number;slug:string;creator_id:string;contact_email:string|null}>();
  if (!product) return Response.json({error:"产品不存在"},{status:404});
  const identity=await interactionIdentity(request,db),totals=await engagementTotals(db,id);
  const [liked,favorited,priorLike,priorFavorite]=await Promise.all([
    db.prepare("SELECT id FROM creation_likes WHERE creation_id=? AND user_id=?").bind(id,identity.actor).first(),
    db.prepare("SELECT id FROM creation_favorites WHERE creation_id=? AND user_id=?").bind(id,identity.actor).first(),
    db.prepare("SELECT id FROM creation_events WHERE creation_id=? AND actor_id=? AND event_type='liked' LIMIT 1").bind(id,identity.actor).first(),
    db.prepare("SELECT id FROM creation_events WHERE creation_id=? AND actor_id=? AND event_type='favorited' LIMIT 1").bind(id,identity.actor).first(),
  ]);
  return visitorJson(request,identity.visitorId,{...totals,liked:Boolean(liked),favorited:Boolean(favorited),selfInteractionLimited:identity.user?.id===product.creator_id&&!identity.owner,selfLikeUsed:Boolean(priorLike),selfFavoriteUsed:Boolean(priorFavorite),contactEmail:product.contact_email,slug:product.slug});
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({error:"请求来源无效"},{status:403});
  const db=runtime().DB;
  if (!db) return Response.json({error:"数据库暂不可用"},{status:503});
  const body=await request.json() as {creationId?:number;action?:string;requestId?:string;shareToken?:string;source?:string};
  const id=Number(body.creationId);
  if (!id || !["favorite","share","prepare-share","view"].includes(body.action||"")) return Response.json({error:"操作信息不正确"},{status:400});
  await ensureCreationTables(db);
  const product=await db.prepare("SELECT id,slug,creator_id FROM creations WHERE id=? AND visibility='published'").bind(id).first<{id:number;slug:string;creator_id:string}>();
  if (!product) return Response.json({error:"产品不存在"},{status:404});
  const identity=await interactionIdentity(request,db);
  if (body.action==="prepare-share") {
    const token=crypto.randomUUID();
    await db.prepare("INSERT INTO product_share_links(token,creation_id,actor_id,visitor_id) VALUES(?,?,?,?)").bind(token,id,identity.actor,identity.visitorId).run();
    return visitorJson(request,identity.visitorId,{token,url:`/work/${encodeURIComponent(product.slug)}?ref=${token}`});
  }
  if (body.action==="share") {
    if (!validRequestId(body.shareToken)) return Response.json({error:"分享链接无效，请重试"},{status:400});
    const link=await db.prepare("SELECT token FROM product_share_links WHERE token=? AND creation_id=? AND actor_id=?").bind(body.shareToken,id,identity.actor).first();
    if (!link) return Response.json({error:"分享链接无效，请重试"},{status:400});
    const result=await db.prepare("INSERT OR IGNORE INTO creation_shares(creation_id,user_id,source,share_token) VALUES(?,?,?,?)").bind(id,identity.user?.id||null,body.source==="native-share"?"native-share":"copy-link",body.shareToken).run();
    return visitorJson(request,identity.visitorId,{ok:true,counted:Number(result.meta.changes||0)>0,...await engagementTotals(db,id)});
  }
  if (body.action==="view") {
    if (isKnownBot(request)) return visitorJson(request,identity.visitorId,{ok:true,counted:false,...await engagementTotals(db,id)});
    const visitorKey=identity.owner&&validRequestId(body.requestId)?`owner:${identity.actor}:${body.requestId}`:identity.actor;
    await db.prepare("INSERT OR IGNORE INTO creation_views(creation_id,visitor_key,bucket) VALUES(?,?,?)").bind(id,visitorKey,String(Math.floor(Date.now()/1800000))).run();
    let counted=false;
    if (validRequestId(body.shareToken)) {
      const link=await db.prepare("SELECT actor_id,visitor_id FROM product_share_links WHERE token=? AND creation_id=?").bind(body.shareToken,id).first<{actor_id:string;visitor_id:string}>();
      if (link && link.actor_id!==identity.actor && link.visitor_id!==identity.visitorId) {
        const result=await db.batch([
          db.prepare("INSERT OR IGNORE INTO creation_shares(creation_id,user_id,source,share_token) VALUES(?,?,?,?)").bind(id,link.actor_id.startsWith("visitor:")?null:link.actor_id,"referral-open",body.shareToken),
          db.prepare("INSERT OR IGNORE INTO product_share_opens(creation_id,visitor_key,visitor_id,share_token) SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM product_share_seen WHERE creation_id=? AND identity_key IN (?,?))").bind(id,identity.actor,identity.visitorId,body.shareToken,id,identity.actor,`browser:${identity.visitorId}`),
          db.prepare("INSERT OR IGNORE INTO product_share_seen(creation_id,identity_key) VALUES(?,?)").bind(id,identity.actor),
          db.prepare("INSERT OR IGNORE INTO product_share_seen(creation_id,identity_key) VALUES(?,?)").bind(id,`browser:${identity.visitorId}`),
        ]);
        counted=Number(result[1].meta.changes||0)>0;
      }
    }
    return visitorJson(request,identity.visitorId,{ok:true,counted,...await engagementTotals(db,id)});
  }
  if (!validRequestId(body.requestId)) return Response.json({error:"操作信息不正确，请刷新页面重试"},{status:400});
  const result=await countInteraction(db,product,identity,"favorited",body.requestId);
  return visitorJson(request,identity.visitorId,{ok:true,favorited:true,...result,...await engagementTotals(db,id)});
}
