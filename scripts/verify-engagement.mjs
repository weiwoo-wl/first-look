// Exercises the real route handlers and SQL against an isolated in-memory SQLite database.
// Run: node --experimental-vm-modules scripts/verify-engagement.mjs
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import ts from "typescript";

const sqlite = new DatabaseSync(":memory:");
sqlite.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,display_name TEXT,disabled_at TEXT,contact_enabled INTEGER DEFAULT 0,created_at TEXT);
CREATE TABLE creations(id INTEGER PRIMARY KEY,slug TEXT,creator_id TEXT,title TEXT,visibility TEXT,created_at TEXT,updated_at TEXT);
INSERT INTO users(id,email,display_name,created_at) VALUES('owner','owner@example.test','Owner','2020-01-01'),('creator','creator@example.test','Creator','2021-01-01'),('other','other@example.test','Other','2022-01-01');
INSERT INTO creations VALUES(1,'one','creator','One','published','2026-01-01','2026-01-01'),(2,'two','owner','Two','published','2026-01-01','2026-01-01');`);
const db = {
  prepare(sql) {
    let values = [];
    return {
      bind(...args) { values = args; return this; },
      async run() { const result = sqlite.prepare(sql).run(...values); return { meta:{changes:Number(result.changes)},success:true }; },
      async first() { return sqlite.prepare(sql).get(...values) || null; },
      async all() { return { results:sqlite.prepare(sql).all(...values) }; },
    };
  },
  async batch(statements) {
    sqlite.exec("BEGIN");
    try { const results=[];for(const statement of statements)results.push(await statement.run());sqlite.exec("COMMIT");return results; }
    catch(error) { sqlite.exec("ROLLBACK");throw error; }
  },
};
const context=vm.createContext({crypto:webcrypto,Request,Response,Headers,URL,console});
const modules=new Map(),root=process.cwd();
async function moduleAt(file) {
  file=path.resolve(file);
  if(modules.has(file))return modules.get(file);
  let module;
  if(file.endsWith(path.join("lib","auth.ts"))) {
    const exports={runtime:()=>({DB:db}),ensureAuthTables:async()=>{},currentUser:async request=>{const id=request.headers.get("x-user");return id?{id,email:`${id}@example.test`,displayName:id}:null;},sameOrigin:request=>request.headers.get("Origin")===new URL(request.url).origin};
    module=new vm.SyntheticModule(Object.keys(exports),function(){for(const [name,value]of Object.entries(exports))this.setExport(name,value);},{context,identifier:file});
  } else if(file.endsWith(path.join("lib","technical.ts"))||file.endsWith(path.join("lib","creator-profile.ts"))) {
    const name=file.endsWith("technical.ts")?"readTechnical":"ensureCreatorProfileTables";
    module=new vm.SyntheticModule([name],function(){this.setExport(name,async()=>({}));},{context,identifier:file});
  } else {
    const source=await readFile(file,"utf8");
    const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
    module=new vm.SourceTextModule(output,{context,identifier:file});
  }
  modules.set(file,module);
  await module.link((specifier,parent)=>moduleAt(path.resolve(path.dirname(parent.identifier),`${specifier}.ts`)));
  return module;
}
async function load(file){const module=await moduleAt(path.join(root,file));if(module.status!=="evaluated")await module.evaluate();return module.namespace;}
const creations=await load("app/lib/creations.ts");
await creations.ensureCreationTables(db);
// Legacy membership without an event must migrate once, retaining its original time.
sqlite.exec("DELETE FROM engagement_migrations; INSERT INTO creation_likes(creation_id,user_id,created_at) VALUES(1,'other','2026-01-01');");
await creations.ensureCreationTables(db);await creations.ensureCreationTables(db);
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM creation_events WHERE event_type='liked'").get().n,1);
const react=await load("app/api/creations/react/route.ts"),actions=await load("app/api/creations/actions/route.ts"),reports=await load("app/api/reports/route.ts");
const engagement=await load("app/lib/engagement.ts"),ranking=await load("app/lib/ranking.ts");
const id=()=>webcrypto.randomUUID();
function request(body,user,cookie="",headers={}){return new Request("https://example.test/api/creations/actions",{method:"POST",headers:{Origin:"https://example.test","Content-Type":"application/json","User-Agent":"Mozilla/5.0",...(user?{"x-user":user}:{}),...(cookie?{Cookie:cookie}:{}),...headers},body:JSON.stringify(body)});}
async function post(route,body,user,cookie="",headers={}){const response=await route.POST(request(body,user,cookie,headers));return {response,data:await response.json(),cookie:response.headers.get("Set-Cookie")?.split(";")[0]||cookie};}
let key=id(),result=await post(react,{creationId:1,requestId:key},"other");
assert.equal(result.data.count,2);assert.equal(result.data.counted,true);
result=await post(react,{creationId:1,requestId:key},"other");assert.equal(result.data.count,2);assert.equal(result.data.counted,false);
result=await post(react,{creationId:1,requestId:id()},"other");assert.equal(result.data.count,3);
await post(react,{creationId:1,requestId:id()},"creator");
result=await post(react,{creationId:1,requestId:id()},"creator");assert.equal(result.data.count,4);assert.equal(result.data.counted,false);
await post(react,{creationId:2,requestId:id()},"owner");
result=await post(react,{creationId:2,requestId:id()},"owner");assert.equal(result.data.count,2);
result=await post(actions,{creationId:1,action:"favorite",requestId:id()});const guestCookie=result.cookie;
assert.equal(result.data.favorites,1);
result=await post(actions,{creationId:1,action:"favorite",requestId:id()},null,guestCookie);assert.equal(result.data.favorites,2);
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM creation_favorites WHERE creation_id=1").get().n,1);
await post(actions,{creationId:1,action:"favorite",requestId:id()},"creator");
result=await post(actions,{creationId:1,action:"favorite",requestId:id()},"creator");assert.equal(result.data.favorites,3);assert.equal(result.data.counted,false);
result=await post(reports,{targetType:"creation",targetId:1,reason:"其他问题"});assert.equal(result.response.status,401);
const prepared=await post(actions,{creationId:1,action:"prepare-share"},"creator");
assert.match(prepared.data.url,/\?ref=/);
assert.equal((await engagement.engagementTotals(db,1)).shares,0);
await post(actions,{creationId:1,action:"share",shareToken:prepared.data.token},"creator",prepared.cookie);
await post(actions,{creationId:1,action:"share",shareToken:prepared.data.token},"creator",prepared.cookie);
assert.equal((await engagement.engagementTotals(db,1)).shares,1);
result=await post(actions,{creationId:1,action:"view",shareToken:prepared.data.token},"creator",prepared.cookie);assert.equal(result.data.share_opens,0);
result=await post(actions,{creationId:1,action:"view",shareToken:prepared.data.token},null,guestCookie);assert.equal(result.data.share_opens,1);
result=await post(actions,{creationId:1,action:"view",shareToken:prepared.data.token},null,guestCookie);assert.equal(result.data.share_opens,1);
const second=await post(actions,{creationId:1,action:"prepare-share"},"creator",prepared.cookie);
result=await post(actions,{creationId:1,action:"view",shareToken:second.data.token},null,guestCookie);assert.equal(result.data.share_opens,1);assert.equal(result.data.shares,2);
result=await post(actions,{creationId:1,action:"view",shareToken:second.data.token},"other",guestCookie);assert.equal(result.data.share_opens,1);
result=await post(actions,{creationId:1,action:"view",shareToken:second.data.token},"other");assert.equal(result.data.share_opens,1);
result=await post(actions,{creationId:1,action:"view",shareToken:second.data.token},null,"",{"User-Agent":"facebookexternalhit/1.1"});assert.equal(result.data.share_opens,1);
result=await post(actions,{creationId:1,action:"view",shareToken:id()},null);assert.equal(result.data.share_opens,1);
result=await post(actions,{creationId:1,action:"view",shareToken:second.data.token},"owner");assert.equal(result.data.share_opens,2);
result=await post(actions,{creationId:1,action:"view",shareToken:second.data.token},"owner");assert.equal(result.data.share_opens,2);
const totals=await engagement.engagementTotals(db,1);
const lists=await load("app/api/account/interactions/route.ts");
await post(lists,{creationId:1,action:"remove-like"},"other");
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM creation_likes WHERE creation_id=1 AND user_id='other'").get().n,0);
assert.equal((await engagement.engagementTotals(db,1)).likes,totals.likes);
await post(react,{creationId:1,requestId:key},"other");
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM creation_likes WHERE creation_id=1 AND user_id='other'").get().n,0);
assert.equal((await post(lists,{creationId:1,action:"remove-favorite"})).response.status,401);
assert.equal(ranking.productScore(totals),totals.likes*2+totals.favorites*4+totals.shares*5+totals.share_opens*10);
assert.ok(sqlite.prepare(`SELECT ${engagement.engagementPeriodColumns(7)} FROM creations c WHERE id=1`).get());
console.log("Passed: historical migration, cumulative clicks, request retries, creator limits, owner exemption, list deduplication, anonymous report denial, share confirmation, referral deduplication, self/bot exclusion, ranking weights.");
sqlite.close();
