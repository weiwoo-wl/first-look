import { UPLOAD_LIMITS } from "./upload-limits";
export type TechnicalLink = { title: string; url: string; description: string };
export type TechnicalFile = { object_key: string; name: string; size: number };
export type MiniProgramEntry = { name: string; originalId: string; entryVerified: boolean; qrObjectKey?: string };
export type Technical = { notes: string; links: TechnicalLink[]; files: TechnicalFile[]; miniProgram?: MiniProgramEntry };
export type NormalizedTechnical = { notes: string; links: TechnicalLink[]; miniProgram: MiniProgramEntry };
export const TECHNICAL_EXTENSIONS = [".md", ".txt", ".json", ".yaml", ".yml", ".py", ".js", ".ts", ".sh", ".zip"];
export const TECHNICAL_MAX_SIZE = UPLOAD_LIMITS.technical;
export function allowedTechnicalName(name: string) {
  return TECHNICAL_EXTENSIONS.some(extension => name.toLowerCase().endsWith(extension));
}
export function resourceLinkTitle(value: string) {
  if (/^#小程序:\/\//.test(value.trim())) return "微信小程序";
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") return url.hostname;
    if (url.protocol !== "javascript:" && url.protocol !== "data:" && url.protocol !== "vbscript:") return "应用跳转";
  } catch {}
  return "打开资源";
}
export function isWebResourceLink(value: string) {
  const link = value.trim();
  if (/^https?:\/\//i.test(link)) return true;
  return /^(?!javascript:|data:|vbscript:)[a-z][a-z\d+.-]*:\S+$/i.test(link);
}
export function normalizeResourceValue(value: string) {
  const result = value.trim();
  if (!result || result.length > 2048 || /[\u0000-\u001f\u007f]/.test(result) || /^(javascript|data|vbscript):/i.test(result)) throw Error("入口内容格式不正确");
  if (isWebResourceLink(result)) {
    let parsed: URL;
    try { parsed = new URL(result); } catch { throw Error("网址格式不正确"); }
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) throw Error("网址格式不正确");
  }
  return result;
}
export function normalizeProductEntry(value: string, type: string) {
  const result = value.trim();
  if (type !== "小程序") return result ? normalizeResourceValue(result) : "";
  if (result.length > 4096 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result) || /^(javascript|data|vbscript):/i.test(result)) throw Error("小程序分享内容格式不正确或过长");
  return result;
}
export function extractSharedUrl(value: string) {
  const match = value.match(/https?:\/\/[^\s<>"'）)】\]]+/i)?.[0]?.replace(/[，。；、,.!?！？]+$/u, "");
  if (!match) return "";
  try { const url = new URL(match); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.toString() : ""; } catch { return ""; }
}
export function normalizeTechnical(value: unknown): NormalizedTechnical {
  if (value == null) return { notes: "", links: [], miniProgram: { name: "", originalId: "", entryVerified: false } };
  if (typeof value !== "object") throw Error("技术分享格式不正确");
  const input = value as {notes?: unknown; links?: unknown; miniProgram?: unknown};
  if (input.notes !== undefined && typeof input.notes !== "string") throw Error("实现思路需要填写文字");
  const notes = (input.notes as string || "").trim();
  if (notes.length > 20000) throw Error("实现思路最多 20000 字");
  if (input.links !== undefined && !Array.isArray(input.links)) throw Error("资源链接格式不正确");
  const rows = (input.links || []) as unknown[];
  if (rows.length > 8) throw Error("资源链接最多 8 个");
  const links = rows.map(row => {
    if (!row || typeof row !== "object") throw Error("资源链接格式不正确");
    const item = row as Record<string, unknown>;
    if (typeof item.url !== "string") throw Error("请填写资源链接或口令");
    const url = item.url.trim();
    if (!url) return null;
    try { normalizeResourceValue(url); } catch { throw Error("资源链接或口令格式不正确"); }
    const title = typeof item.title === "string" && item.title.trim() ? item.title.trim() : resourceLinkTitle(url);
    const description = typeof item.description === "string" ? item.description.trim() : "";
    if (title.length > 100 || description.length > 500) throw Error("资源链接信息过长");
    return { title, url, description };
  }).filter((item): item is TechnicalLink => item !== null);
  const miniInput = input.miniProgram && typeof input.miniProgram === "object" ? input.miniProgram as Record<string, unknown> : {};
  const miniProgram = {
    name: typeof miniInput.name === "string" ? miniInput.name.trim() : "",
    originalId: typeof miniInput.originalId === "string" ? miniInput.originalId.trim() : "",
    entryVerified: miniInput.entryVerified === true,
  };
  if (miniProgram.name.length > 100 || miniProgram.originalId.length > 100) throw Error("小程序名称或原始 ID 过长");
  return { notes, links, miniProgram };
}
export async function readTechnical(db: D1Database, creationId: number): Promise<Technical> {
  const row = await db.prepare("SELECT notes,links_json FROM creation_technical WHERE creation_id=?").bind(creationId).first<{notes:string;links_json:string}>();
  const files = await db.prepare("SELECT object_key,name,size FROM creation_technical_files WHERE creation_id=? ORDER BY rowid").bind(creationId).all<TechnicalFile>();
  let saved: unknown;
  try { saved = JSON.parse(row?.links_json || "[]"); } catch { saved = []; }
  const data = Array.isArray(saved) ? { links: saved } : saved && typeof saved === "object" ? saved as { links?: unknown; miniProgram?: unknown } : {};
  const normalized = normalizeTechnical({ notes: row?.notes || "", links: data.links || [], miniProgram: data.miniProgram });
  return { ...normalized, files: files.results };
}
