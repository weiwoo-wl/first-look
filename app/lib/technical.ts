import { UPLOAD_LIMITS } from "./upload-limits";
export type TechnicalLink = { title: string; url: string; description: string };
export type TechnicalFile = { object_key: string; name: string; size: number };
export type Technical = { notes: string; links: TechnicalLink[]; files: TechnicalFile[] };
export const TECHNICAL_EXTENSIONS = [".md", ".txt", ".json", ".yaml", ".yml", ".py", ".js", ".ts", ".sh", ".zip"];
export const TECHNICAL_MAX_SIZE = UPLOAD_LIMITS.technical;
export function allowedTechnicalName(name: string) {
  return TECHNICAL_EXTENSIONS.some(extension => name.toLowerCase().endsWith(extension));
}
export function normalizeTechnical(value: unknown): Omit<Technical, "files"> {
  if (value == null) return { notes: "", links: [] };
  if (typeof value !== "object") throw Error("技术分享格式不正确");
  const input = value as {notes?: unknown; links?: unknown};
  if (input.notes !== undefined && typeof input.notes !== "string") throw Error("实现思路需要填写文字");
  const notes = (input.notes as string || "").trim();
  if (notes.length > 20000) throw Error("实现思路最多 20000 字");
  if (input.links !== undefined && !Array.isArray(input.links)) throw Error("资源链接格式不正确");
  const rows = (input.links || []) as unknown[];
  if (rows.length > 8) throw Error("资源链接最多 8 个");
  const links = rows.map(row => {
    if (!row || typeof row !== "object") throw Error("资源链接格式不正确");
    const item = row as Record<string, unknown>;
    if (typeof item.url !== "string" || item.url.length > 2048) throw Error("请填写有效的资源链接");
    let url: URL;
    try { url = new URL(item.url); } catch { throw Error("资源链接应以 https:// 或 http:// 开头"); }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw Error("资源链接应使用 http 或 https 地址");
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const description = typeof item.description === "string" ? item.description.trim() : "";
    if (!title || title.length > 100 || description.length > 500) throw Error("请填写资源名称（100 字以内）和简短说明（500 字以内）");
    return { title, url: url.href, description };
  });
  return { notes, links };
}
export async function readTechnical(db: D1Database, creationId: number): Promise<Technical> {
  const row = await db.prepare("SELECT notes,links_json FROM creation_technical WHERE creation_id=?").bind(creationId).first<{notes:string;links_json:string}>();
  const files = await db.prepare("SELECT object_key,name,size FROM creation_technical_files WHERE creation_id=? ORDER BY rowid").bind(creationId).all<TechnicalFile>();
  return { notes: row?.notes || "", links: JSON.parse(row?.links_json || "[]"), files: files.results };
}
