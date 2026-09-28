"use client";

import { ArrowLeft, ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { allowedTechnicalName, TECHNICAL_MAX_SIZE, type TechnicalLink } from "../../../../lib/technical";
import { UPLOAD_LIMITS, formatBytes } from "../../../../lib/upload-limits";

type Product = { id: number; slug: string; title: string; description: string; type: string; status: string; story: string; tags: string; product_url: string; visibility: string; updated_at: string };
type MediaRow = { object_key: string; media_type: string; mime_type: string; size: number; sort_order: number };
type TechFile = { object_key: string; name: string; size: number };
type EditorMedia = ({ kind: "existing" } & MediaRow) | { kind: "new"; file: File; preview: string; uploadKey?: string; uploadId?: string; parts?: R2UploadedPart[] };
type EditorFile = ({ kind: "existing" } & TechFile) | { kind: "new"; file: File; uploadKey?: string };
const types = ["工具", "小程序", "网页", "视频", "数字人", "Skill", "图片", "音频", "文本", "实验", "其他"];
const statuses = ["正在使用", "早期测试", "概念阶段"];
const input = "mt-2 w-full rounded-lg border border-black/15 bg-white px-4 py-3 text-sm outline-none focus:border-black/55";

async function json<T>(response: Response): Promise<T> {
  const text = await response.text();
  try { return (text ? JSON.parse(text) : {}) as T; } catch { return {} as T; }
}

export default function EditProductEditor() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [product, setProduct] = useState<Product | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("工具");
  const [status, setStatus] = useState("早期测试");
  const [story, setStory] = useState("");
  const [tags, setTags] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [media, setMedia] = useState<EditorMedia[]>([]);
  const [notes, setNotes] = useState("");
  const [links, setLinks] = useState<TechnicalLink[]>([]);
  const [techFiles, setTechFiles] = useState<EditorFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const mediaRef = useRef(media);
  const totalSize = useMemo(() => media.reduce((sum, item) => sum + (item.kind === "existing" ? item.size : item.file.size), 0) + techFiles.reduce((sum, item) => sum + (item.kind === "existing" ? item.size : item.file.size), 0), [media, techFiles]);

  useEffect(() => {
    let active = true;
    fetch(`/api/creations/update?creationId=${id}`, { cache: "no-store" })
      .then(async (response) => { const data = await json<{ error?: string; product: Product; media: MediaRow[]; technical: { notes: string; links: TechnicalLink[]; files: TechFile[] } }>(response); if (!response.ok) throw Error(data.error || "产品暂时无法打开"); return data; })
      .then((data) => {
        if (!active) return;
        setProduct(data.product); setTitle(data.product.title); setDescription(data.product.description); setType(data.product.type); setStatus(data.product.status); setStory(data.product.story || ""); setTags(data.product.tags || ""); setProductUrl(data.product.product_url || "");
        setMedia(data.media.map((item) => ({ kind: "existing", ...item })));
        setNotes(data.technical.notes || ""); setLinks(data.technical.links || []); setTechFiles(data.technical.files.map((item) => ({ kind: "existing", ...item })));
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "产品暂时无法打开"))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => { mediaRef.current = media; }, [media]);
  useEffect(() => () => { mediaRef.current.forEach((item) => { if (item.kind === "new") URL.revokeObjectURL(item.preview); }); }, []);
  useEffect(() => () => { void fetch("/api/storage/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creationId: id }), keepalive: true }).catch(() => undefined); }, [id]);

  function addMedia(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []); event.target.value = "";
    if (media.length + files.length > 8) { setError("图片和视频最多 8 个"); return; }
    const invalid = files.find((file) => file.size > (file.type.startsWith("image/") ? UPLOAD_LIMITS.image : UPLOAD_LIMITS.video) || !(file.type.startsWith("image/") || ["video/mp4", "video/webm", "video/quicktime"].includes(file.type)));
    if (invalid) { setError(`${invalid.name} 格式或大小不符合要求`); return; }
    setError(""); setMedia((current) => [...current, ...files.map((file) => ({ kind: "new" as const, file, preview: URL.createObjectURL(file) }))]);
  }

  function addTechnicalFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []); event.target.value = "";
    if (techFiles.length + files.length > 5) { setError("资料文件最多 5 份"); return; }
    const invalid = files.find((file) => !file.size || file.size > TECHNICAL_MAX_SIZE || !allowedTechnicalName(file.name));
    if (invalid) { setError(`${invalid.name} 格式或大小不符合要求，每份最多 10MB`); return; }
    setError(""); setTechFiles((current) => [...current, ...files.map((file) => ({ kind: "new" as const, file }))]);
  }

  function moveMedia(index: number, direction: -1 | 1) {
    setMedia((current) => { const target = index + direction; if (target < 0 || target >= current.length) return current; const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next; });
  }

  async function uploadMedia(item: Extract<EditorMedia, { kind: "new" }>) {
    if (item.uploadKey && item.uploadId && item.parts) return { key: item.uploadKey, uploadId: item.uploadId, parts: item.parts };
    const start = await fetch("/api/media/init", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creationId: id, type: item.file.type, size: item.file.size, editing: true }) });
    const info = await json<{ key?: string; uploadId?: string; error?: string }>(start);
    if (!start.ok || !info.key || !info.uploadId) throw Error(info.error || "无法开始上传媒体");
    const parts: R2UploadedPart[] = [], chunkSize = UPLOAD_LIMITS.part;
    for (let offset = 0, part = 1; offset < item.file.size; offset += chunkSize, part++) {
      setProgress(`正在上传媒体 ${part}：${item.file.name}`);
      const query = new URLSearchParams({ creationId: String(id), key: info.key, uploadId: info.uploadId, part: String(part) });
      const response = await fetch(`/api/media/part?${query}`, { method: "PUT", body: item.file.slice(offset, Math.min(offset + chunkSize, item.file.size)) });
      const result = await json<R2UploadedPart & { error?: string }>(response);
      if (!response.ok) throw Error(result.error || "媒体上传中断");
      parts.push(result);
    }
    setMedia((current) => current.map((value) => value === item ? { ...item, uploadKey: info.key, uploadId: info.uploadId, parts } : value));
    return { key: info.key, uploadId: info.uploadId, parts };
  }

  async function uploadTechnical(item: Extract<EditorFile, { kind: "new" }>) {
    if (item.uploadKey) return item.uploadKey;
    setProgress(`正在上传资料：${item.file.name}`);
    const form = new FormData(); form.set("creationId", String(id)); form.set("file", item.file); form.set("editing", "true");
    const response = await fetch("/api/technical/upload", { method: "POST", body: form });
    const result = await json<{ object_key?: string; error?: string }>(response);
    if (!response.ok || !result.object_key) throw Error(result.error || "资料上传失败");
    setTechFiles((current) => current.map((value) => value === item ? { kind: "new", file: item.file, uploadKey: result.object_key } : value));
    return result.object_key;
  }

  async function save(event: FormEvent) {
    event.preventDefault(); if (!product) return;
    if (media.length + techFiles.length > 13 || totalSize > UPLOAD_LIMITS.product) { setError("当前产品图片、视频和资料合计最多 100MB"); return; }
    if (links.some((link) => !link.title.trim() || !link.url.trim())) { setError("请补全每个资源链接的名称和网址，或移除空白链接"); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const uploads: { key: string; uploadId: string; parts: R2UploadedPart[] }[] = [];
      const uploadKeyByFile = new Map<File, string>();
      for (const item of media) if (item.kind === "new") { const uploaded = await uploadMedia(item); uploads.push(uploaded); uploadKeyByFile.set(item.file, uploaded.key); }
      const fileKeys: string[] = [];
      for (const item of techFiles) fileKeys.push(item.kind === "existing" ? item.object_key : await uploadTechnical(item));
      setProgress("正在保存新版本…");
      const response = await fetch("/api/creations/update", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creationId: id, expectedUpdatedAt: product.updated_at, title, description, type, status, story, tags, productUrl, changeNote, technical: { notes, links }, media: media.map((item) => ({ kind: item.kind === "existing" ? "existing" : "upload", key: item.kind === "existing" ? item.object_key : uploadKeyByFile.get(item.file) })), mediaUploads: uploads, technicalFileKeys: fileKeys }) });
      const result = await json<{ error?: string; unchanged?: boolean; updatedAt?: string }>(response);
      if (!response.ok) throw Error(result.error || "保存失败，请稍后重试");
      if (result.unchanged) { setMessage("内容没有变化，无需生成新版本"); setBusy(false); setProgress(""); return; }
      setMessage("已保存为新版本"); setTimeout(() => window.location.assign("/account/products"), 900);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败，请稍后重试"); }
    finally { setBusy(false); setProgress(""); }
  }

  if (loading) return <main className="grid min-h-dvh place-items-center bg-[#f7f7f4] text-sm text-black/50">正在读取产品…</main>;
  if (!product) return <main className="grid min-h-dvh place-items-center bg-[#f7f7f4] px-5 text-center"><div><p role="alert" className="text-sm text-red-700">{error || "产品暂时无法打开"}</p><a href="/account/products" className="mt-5 inline-flex rounded-full border border-black/15 px-4 py-2 text-sm">返回我的产品</a></div></main>;

  return <main className="min-h-dvh bg-[#f7f7f4] px-5 pb-16 text-[#171717]">
    <header className="-mx-5 border-b border-black/10"><div className="mx-auto flex h-16 max-w-3xl items-center px-5"><a href="/account/products" className="inline-flex min-h-11 items-center gap-2 text-sm text-black/55"><ArrowLeft size={16} />返回我的产品</a></div></header>
    <section className="mx-auto max-w-3xl py-10"><p className="text-sm text-[#e15d36]">完善你的产品</p><h1 className="mt-2 text-4xl font-semibold tracking-[-.06em]">编辑产品</h1><p className="mt-3 text-sm leading-6 text-black/55">每次保存都会成为生命线上的新版本。旧版本的照片、视频和资料仍可查看。</p>
      <form onSubmit={save} className="mt-8 space-y-7">
        <label className="block text-sm font-medium">作品名称<input required minLength={2} maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} className={input} /></label>
        <label className="block text-sm font-medium">一句话介绍<textarea required minLength={10} maxLength={500} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className={input} /></label>
        <fieldset><legend className="text-sm font-medium">作品类型</legend><div className="mt-3 flex flex-wrap gap-2">{types.map((item) => <button type="button" key={item} onClick={() => setType(item)} aria-pressed={type === item} className={`rounded-full border px-4 py-2 text-sm ${type === item ? "border-black bg-black text-white" : "border-black/15 bg-white text-black/55"}`}>{item}</button>)}</div></fieldset>
        <fieldset><legend className="text-sm font-medium">当前状态</legend><div className="mt-3 flex flex-wrap gap-2">{statuses.map((item) => <button type="button" key={item} onClick={() => setStatus(item)} aria-pressed={status === item} className={`rounded-full border px-4 py-2 text-sm ${status === item ? "border-black bg-black text-white" : "border-black/15 bg-white text-black/55"}`}>{item}</button>)}</div></fieldset>
        <label className="block text-sm font-medium">产品主页或体验链接<input type="url" value={productUrl} onChange={(event) => setProductUrl(event.target.value)} placeholder="https://" className={input} /></label>
        <label className="block text-sm font-medium">标签（选填，用逗号分隔）<input maxLength={300} value={tags} onChange={(event) => setTags(event.target.value)} placeholder="例如：效率、AI、创作" className={input} /></label>
        <label className="block text-sm font-medium">为什么做？<textarea maxLength={2000} rows={4} value={story} onChange={(event) => setStory(event.target.value)} className={input} /></label>
        <section className="rounded-xl border border-black/10 bg-white p-5"><div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-semibold">图片和视频</h2><span className="text-xs text-black/40">最多 8 个 · 图片 5MB · 视频 50MB</span></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{media.map((item, index) => { const src = item.kind === "existing" ? `/api/media/file?key=${encodeURIComponent(item.object_key)}` : item.preview; return <div key={item.kind === "existing" ? item.object_key : `${item.file.name}-${index}`} className="relative aspect-square overflow-hidden rounded-lg bg-black/5">{(item.kind === "existing" ? item.media_type : item.file.type.startsWith("video/") ? "video" : "image") === "video" ? <video src={src} controls className="h-full w-full object-cover" /> : <img src={src} alt="产品图片" className="h-full w-full object-cover" />}<div className="absolute inset-x-1 bottom-1 flex items-center justify-between rounded-full bg-black/65 px-2 py-1 text-white"><button type="button" disabled={!index} aria-label="向前移动" onClick={() => moveMedia(index, -1)} className="p-1 disabled:opacity-30"><ChevronUp size={15} /></button><span className="text-[10px]">{index + 1}</span><button type="button" disabled={index === media.length - 1} aria-label="向后移动" onClick={() => moveMedia(index, 1)} className="p-1 disabled:opacity-30"><ChevronDown size={15} /></button></div><button type="button" aria-label="移除此图片或视频" onClick={() => { if (item.kind === "new") URL.revokeObjectURL(item.preview); setMedia((current) => current.filter((_, row) => row !== index)); }} className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-white/90"><X size={14} /></button></div>; })}</div><label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full border border-black/15 px-4 py-2.5 text-sm"><Plus size={15} />添加图片或视频<input type="file" multiple accept="image/*,video/mp4,video/webm,video/quicktime" onChange={addMedia} className="sr-only" /></label></section>
        <section className="rounded-xl border border-black/10 bg-[#eeeee8] p-5"><h2 className="font-semibold">技术分享（选填）</h2><p className="mt-2 text-xs leading-5 text-black/50">补充实现思路、Skill、代码或教程。</p><label className="mt-5 block text-sm font-medium">实现思路<textarea maxLength={20000} rows={6} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="用了哪些工具？怎么实现的？" className={input} /></label><div className="mt-5 space-y-3"><p className="text-sm font-medium">资源链接</p>{links.map((link, index) => <div key={index} className="space-y-2 rounded-lg border border-black/10 bg-white p-3"><label className="block text-xs">资源名称<input required maxLength={100} value={link.title} onChange={(event) => setLinks((current) => current.map((row, i) => i === index ? { ...row, title: event.target.value } : row))} className={input} /></label><label className="block text-xs">链接地址<input required type="url" maxLength={2048} value={link.url} onChange={(event) => setLinks((current) => current.map((row, i) => i === index ? { ...row, url: event.target.value } : row))} placeholder="https://" className={input} /></label><label className="block text-xs">用途说明（选填）<input maxLength={500} value={link.description} onChange={(event) => setLinks((current) => current.map((row, i) => i === index ? { ...row, description: event.target.value } : row))} className={input} /></label><button type="button" onClick={() => setLinks((current) => current.filter((_, i) => i !== index))} className="text-xs text-red-700">移除链接</button></div>)}{links.length < 8 && <button type="button" onClick={() => setLinks((current) => [...current, { title: "", url: "", description: "" }])} className="rounded-full border border-black/15 bg-white px-4 py-2 text-xs">＋ 添加资源链接</button>}</div><div className="mt-5 space-y-3"><p className="text-sm font-medium">资料文件 <span className="text-xs font-normal text-black/45">最多 5 份，每份 10MB</span></p>{techFiles.map((item, index) => <div key={item.kind === "existing" ? item.object_key : `${item.file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-white p-3 text-xs"><span className="min-w-0 break-all">{item.kind === "existing" ? item.name : item.file.name}</span><button type="button" onClick={() => setTechFiles((current) => current.filter((_, i) => i !== index))} className="shrink-0 px-2 py-1 text-red-700">移除</button></div>)}<label className="inline-flex cursor-pointer rounded-full border border-black/15 bg-white px-4 py-2.5 text-sm">选择资料文件<input type="file" multiple accept=".md,.txt,.json,.yaml,.yml,.py,.js,.ts,.sh,.zip" onChange={addTechnicalFiles} className="sr-only" /></label></div></section>
        <label className="block text-sm font-medium">本次更新说明（选填）<input maxLength={240} value={changeNote} onChange={(event) => setChangeNote(event.target.value)} placeholder="例如：补上使用教程，更新产品截图" className={input} /></label>
        <div className="rounded-lg border border-black/10 bg-white p-4 text-xs text-black/55">当前版本文件合计 {formatBytes(totalSize)} / 100MB。历史版本保留的旧文件也会占用账号空间。</div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}{message && <p role="status" className="text-sm text-emerald-700">{message}</p>}{progress && <p role="status" aria-live="polite" className="text-sm text-black/55">{progress}</p>}
        <div className="flex flex-wrap gap-3"><button disabled={busy} className="min-h-12 rounded-full bg-black px-6 py-3 text-sm font-medium text-white disabled:opacity-50">{busy ? "正在保存…" : "保存为新版本"}</button><a href="/account/products" className="inline-flex min-h-12 items-center rounded-full border border-black/15 px-5 py-3 text-sm">取消</a></div>
      </form>
    </section>
  </main>;
}
