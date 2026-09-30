// Exercises announcement delivery and private notification reads against SQLite.
// Run: node --experimental-vm-modules scripts/verify-notifications.mjs
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const sqlite = new DatabaseSync(":memory:");
sqlite.exec("CREATE TABLE users(id TEXT PRIMARY KEY,disabled_at TEXT);");
const db = {
  prepare(sql) {
    let values = [];
    return {
      bind(...args) { values = args; return this; },
      async run() { const result = sqlite.prepare(sql).run(...values); return { meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } }; },
      async first() { return sqlite.prepare(sql).get(...values) || null; },
      async all() { return { results: sqlite.prepare(sql).all(...values) }; },
    };
  },
  async batch(statements) { return Promise.all(statements.map(statement => statement.run())); },
};
const context = vm.createContext({ Request, Response, Headers, URL, console });
const modules = new Map(), root = process.cwd();

async function moduleAt(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file);
  let module;
  if (file.endsWith(path.join("lib", "auth.ts"))) {
    const exports = {
      currentUser: async request => { const id = request.headers.get("x-user"); return id ? { id } : null; },
      runtime: () => ({ DB: db }),
      sameOrigin: request => request.headers.get("Origin") === new URL(request.url).origin,
    };
    module = new vm.SyntheticModule(Object.keys(exports), function () { for (const [name, value] of Object.entries(exports)) this.setExport(name, value); }, { context, identifier: file });
  } else if (file.endsWith(path.join("lib", "admin.ts"))) {
    const exports = { currentAdmin: async () => ({ id: "admin-1" }), logAdminAction: async () => {} };
    module = new vm.SyntheticModule(Object.keys(exports), function () { for (const [name, value] of Object.entries(exports)) this.setExport(name, value); }, { context, identifier: file });
  } else {
    const source = await readFile(file, "utf8");
    const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
    module = new vm.SourceTextModule(output, { context, identifier: file });
  }
  modules.set(file, module);
  await module.link((specifier, parent) => moduleAt(path.resolve(path.dirname(parent.identifier), `${specifier}.ts`)));
  return module;
}
async function load(file) { const module = await moduleAt(path.join(root, file)); if (module.status !== "evaluated") await module.evaluate(); return module.namespace; }

const announcements = await load("app/lib/announcements.ts");
await announcements.ensureAnnouncementTable(db);
sqlite.prepare("INSERT INTO site_announcements(title,content,status,updated_by) VALUES('旧公告','上线前已有','published','admin-1')").run();
const notificationStore = await load("app/lib/notifications.ts");
await notificationStore.ensureNotificationTable(db);
sqlite.exec("INSERT INTO users(id) VALUES('user-1'),('user-2'); INSERT INTO users(id,disabled_at) VALUES('disabled','2026-01-01');");

const announcementApi = await load("app/api/announcements/route.ts");
const noticesApi = await load("app/api/notifications/route.ts");
const request = (url, body, user, method = "POST") => new Request(`https://example.test${url}`, { method, headers: { Origin: "https://example.test", "Content-Type": "application/json", ...(user ? { "x-user": user } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

assert.equal((await noticesApi.GET(request("/api/notifications", undefined, null, "GET"))).status, 401);
const published = await announcementApi.POST(request("/api/announcements", { title: "新公告", content: "上线后发布", status: "published" }, "admin-1"));
assert.equal(published.status, 200);
assert.equal((await published.json()).notified, 2);
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM user_notifications WHERE title='旧公告'").get().n, 0);

let user1 = await (await noticesApi.GET(request("/api/notifications", undefined, "user-1", "GET"))).json();
let user2 = await (await noticesApi.GET(request("/api/notifications", undefined, "user-2", "GET"))).json();
assert.equal(user1.unread, 1); assert.equal(user2.unread, 1);
const ownId = user1.notifications[0].id, otherId = user2.notifications[0].id;
assert.equal((await noticesApi.PATCH(request("/api/notifications", { id: otherId }, "user-1", "PATCH"))).status, 200);
user2 = await (await noticesApi.GET(request("/api/notifications", undefined, "user-2", "GET"))).json();
assert.equal(user2.unread, 1, "users cannot mark another user's notice as read");
assert.equal((await noticesApi.PATCH(request("/api/notifications", { id: ownId }, "user-1", "PATCH"))).status, 200);
user1 = await (await noticesApi.GET(request("/api/notifications", undefined, "user-1", "GET"))).json();
assert.equal(user1.unread, 0);

await announcementApi.POST(request("/api/announcements", { id: 1, title: "旧公告", content: "上线前已有", status: "unpublished" }, "admin-1"));
const republishedOld = await announcementApi.POST(request("/api/announcements", { id: 1, title: "旧公告", content: "重新发布", status: "published" }, "admin-1"));
assert.equal((await republishedOld.json()).notified, 0);
console.log("PASS: no retroactive notices, active-user announcement delivery, unread counts, and recipient isolation.");
sqlite.close();
