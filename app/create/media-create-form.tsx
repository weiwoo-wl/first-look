"use client";
import { UPLOAD_LIMITS, formatBytes, type StorageQuota } from "../lib/upload-limits";
import TechnicalEditor from "./technical-editor";
import type { TechnicalLink } from "../lib/technical";
import Link from "next/link";import{FormEvent,useEffect,useState}from"react";import{ArrowLeft,Upload,X}from"lucide-react";
async function readJson<T>(response:Response){const text=await response.text();if(!text)return{}as T;try{return JSON.parse(text)as T}catch{return{}as T}}
const types=["工具","小程序","网页","视频","数字人","Skill","图片","音频","文本","实验","其他"],statuses=["正在使用","早期测试","概念阶段"];
export default function MediaCreateForm() {
  const [storage, setStorage] = useState<StorageQuota | null>(null);
  async function refreshStorage() {
    const response = await fetch("/api/storage/quota");
    if (!response.ok) throw Error(response.status === 401 ? "请先登录后上传文件" : "无法读取剩余空间，请稍后重试");
    const quota = await response.json() as StorageQuota;
    setStorage(quota);
    return quota;
  }
  useEffect(() => {
    let active = true;
    void fetch("/api/storage/quota")
      .then((response) => response.ok ? response.json() as Promise<StorageQuota> : Promise.reject())
      .then((quota) => { if (active) setStorage(quota); })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  const [technicalNotes, setTechnicalNotes] = useState("");
  const [technicalLinks, setTechnicalLinks] = useState<TechnicalLink[]>([]);
  const [technicalFiles, setTechnicalFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [story, setStory] = useState("");
  const [tags, setTags] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [type, setType] = useState("工具");
  const [status, setStatus] = useState("早期测试");
  const [visibility, setVisibility] = useState<"published" | "private">("published");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
const[completed,setCompleted]=useState<{slug:string;visibility:"published"|"private"}|null>(null);
useEffect(()=>{if(completed||progress)return;const dirty=Boolean(title.trim()||description.trim()||story.trim()||tags.trim()||productUrl.trim()||technicalNotes.trim()||technicalLinks.some(link=>link.title.trim()||link.url.trim()||link.description.trim())||technicalFiles.length||files.length||type!=="工具"||status!=="早期测试"||visibility!=="published");if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=""};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn)},[completed,progress,title,description,story,tags,productUrl,technicalNotes,technicalLinks,technicalFiles,files,type,status,visibility]);
function choose(list:FileList|null){if(!list)return;const next=Array.from(list);if(next.length>8){setError("图片视频最多 8 个");return;}const bad=next.find(f=>f.size>(f.type.startsWith("image/")?UPLOAD_LIMITS.image:UPLOAD_LIMITS.video));if(bad){setError(`${bad.name} 超过大小限制`);return}setError("");setFiles(next)}
async function upload(id:number){for(let i=0;i<technicalFiles.length;i++){const f=technicalFiles[i];setProgress(`正在上传资料 ${i+1}/${technicalFiles.length}：${f.name}`);const data=new FormData();data.set("creationId",String(id));data.set("file",f);const response=await fetch("/api/technical/upload",{method:"POST",body:data});if(!response.ok){const result=await readJson<{error?:string}>(response);throw Error(result.error||"资料上传失败");}}const uploads=[];for(let i=0;i<files.length;i++){const f=files[i];setProgress(`正在上传 ${i+1}/${files.length}：${f.name}`);const a=await fetch("/api/media/init",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({creationId:id,type:f.type,size:f.size})}),info=await readJson<{key?:string;uploadId?:string;error?:string}>(a);if(!a.ok||!info.key||!info.uploadId)throw Error(info.error||"无法开始上传");const parts=[],size=8*1024*1024;for(let offset=0,part=1;offset<f.size;offset+=size,part++){const q=new URLSearchParams({creationId:String(id),key:info.key,uploadId:info.uploadId,part:String(part)}),r=await fetch(`/api/media/part?${q}`,{method:"PUT",body:f.slice(offset,Math.min(offset+size,f.size))});if(!r.ok)throw Error("文件上传中断");parts.push(await readJson(r))}uploads.push({key:info.key,uploadId:info.uploadId,type:f.type,size:f.size,parts})}const done=await fetch("/api/media/complete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({creationId:id,uploads})});if(!done.ok){const info=await readJson<{error?:string}>(done);throw Error(info.error||"媒体发布失败")}}
async function submit(e:FormEvent){e.preventDefault();let pendingId:number|undefined;setProgress("正在创建作品…");setError("");try{const total=[...files,...technicalFiles].reduce((sum,file)=>sum+file.size,0);if(total>UPLOAD_LIMITS.product)throw Error("本次发布的全部文件合计不能超过 100MB");if(total){const quota=await refreshStorage();if(total>quota.remaining)throw Error("账号剩余空间不足，请减少文件或删除旧产品");if(total>quota.siteRemaining)throw Error("全站上传空间不足，暂时无法上传这些文件");}const r=await fetch("/api/creations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,description,type,status,story,tags,productUrl,visibility,technical:{notes:technicalNotes,links:technicalLinks},attachmentCount:technicalFiles.length,mediaCount:files.length})});if(r.status===401){location.assign("/login?next=/create");return}const c=await readJson<{id?:number;slug?:string;error?:string}>(r);if(!r.ok||!c.id||!c.slug)throw Error(c.error||"创建失败，服务器没有返回有效结果");pendingId=c.id;if(files.length||technicalFiles.length)await upload(c.id);setCompleted({slug:c.slug,visibility});setProgress("")}catch(x){if(pendingId)await fetch("/api/storage/cancel",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({creationId:pendingId})}).catch(()=>{});void refreshStorage().catch(()=>{});setError(x instanceof Error?x.message:"发布失败");setProgress("")}}
if(completed)return <main className="grid min-h-dvh place-items-center bg-[#f7f7f4] px-5 py-12 text-[#171717]"><section className="w-full max-w-lg rounded-2xl border border-black/10 bg-white p-7 text-center sm:p-10" role="status" aria-live="polite"><p className="text-sm font-medium text-[#e15d36]">分享你的创造</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">{completed.visibility==="published"?"作品发布成功":"作品已保存"}</h1><p className="mt-3 text-sm leading-6 text-black/55">{completed.visibility==="published"?"你的作品已经公开。先发布一个版本，之后也可以继续完善。":"作品仅自己可见，可在“我的产品”中查看和管理。"}</p><div className="mt-7 grid gap-3"><Link href={completed.visibility==="published"?`/work/${encodeURIComponent(completed.slug)}`:"/account/products"} className="inline-flex min-h-12 items-center justify-center rounded-full bg-black px-5 py-3 text-sm font-medium text-white">{completed.visibility==="published"?"查看作品":"在我的产品中查看"}</Link><a href="/" className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/15 px-5 py-3 text-sm">返回发现</a></div></section></main>;
return <main className="min-h-dvh bg-[#f7f7f4] text-[#171717]">
  <header className="border-b border-black/10"><div className="mx-auto flex h-[68px] max-w-3xl items-center px-5"><a href="/" className="inline-flex min-h-11 items-center gap-2 text-sm text-black/55"><ArrowLeft size={16}/>返回发现</a></div></header>
  <section className="mx-auto max-w-3xl px-5 py-12">
    <p className="mb-3 text-sm font-medium text-[#e15d36]">分享你的创造</p>
    <h1 className="text-4xl font-semibold tracking-[-0.06em]">让它被看见。</h1>
    <p className="mt-3 max-w-xl text-sm leading-6 text-black/55">可以先发布一个早期版本，之后再继续完善；不用等到一切都完美。</p>
    <form onSubmit={submit} className="mt-8 space-y-7">
      <label className="block"><b className="mb-2 block text-sm">作品名称</b><input required value={title} onChange={e=>setTitle(e.target.value)} className="w-full rounded-lg border border-black/15 bg-white px-4 py-3 text-base outline-none"/></label>
      <label className="block"><b className="mb-2 block text-sm">一句话介绍</b><textarea required value={description} onChange={e=>setDescription(e.target.value)} rows={3} className="w-full rounded-lg border border-black/15 bg-white px-4 py-3 text-base outline-none"/></label>
      <Choice label="作品类型" items={types} value={type} set={setType}/>
      <Choice label="当前状态" items={statuses} value={status} set={setStatus}/>
      <label className="block"><b className="mb-2 block text-sm">产品主入口（选填）</b><span className="mb-2 block text-xs leading-5 text-black/50">作品页上最主要的访问入口，可填网页地址或小程序口令。</span><input type="text" maxLength={2048} value={productUrl} onChange={e=>setProductUrl(e.target.value)} placeholder="粘贴网页链接、小程序口令等" className="w-full rounded-lg border border-black/15 bg-white px-4 py-3 text-base outline-none"/></label>
      <label className="block"><b className="mb-1 block text-sm">补充关键词（选填）</b><span className="mb-2 block text-xs leading-5 text-black/50">作品类型说明“它是什么”；关键词补充“它有什么特点”。不确定或和类型重复时可以留空。</span><input maxLength={300} value={tags} onChange={e=>setTags(e.target.value)} placeholder="例如：效率、AI、开源（用逗号分隔）" className="w-full rounded-lg border border-black/15 bg-white px-4 py-3 text-base outline-none"/></label>
      <fieldset><legend className="mb-2 text-sm font-medium">谁可以看到</legend><div className="grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={()=>setVisibility("published")} aria-pressed={visibility==="published"} className={`min-h-11 rounded-lg border p-4 text-left ${visibility==="published"?"border-black bg-black text-white":"border-black/15 bg-white text-black/60"}`}><span className="block text-sm font-semibold">公开发布</span><span className={`mt-1 block text-xs ${visibility==="published"?"text-white/65":"text-black/45"}`}>所有人都能在首页和作品链接中看到</span></button>
        <button type="button" onClick={()=>setVisibility("private")} aria-pressed={visibility==="private"} className={`min-h-11 rounded-lg border p-4 text-left ${visibility==="private"?"border-black bg-black text-white":"border-black/15 bg-white text-black/60"}`}><span className="block text-sm font-semibold">仅自己可见</span><span className={`mt-1 block text-xs ${visibility==="private"?"text-white/65":"text-black/45"}`}>只有你能在“我的产品”里查看</span></button>
      </div></fieldset>
      <label className="block"><b className="mb-2 block text-sm">为什么做？（选填）</b><textarea value={story} onChange={e=>setStory(e.target.value)} rows={3} className="w-full rounded-lg border border-black/15 bg-white px-4 py-3 text-base outline-none"/></label>
      <label className="block"><b className="mb-2 block text-sm">图片或视频（最多 8 个）</b><span className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-black/20 bg-white"><Upload/><span className="mt-2 text-sm">选择图片和视频</span><span className="text-xs text-black/40">图片 5MB／视频 50MB</span><input multiple type="file" accept="image/*,video/mp4,video/webm,video/quicktime" onChange={e=>choose(e.target.files)} className="sr-only"/></span></label>
      {files.length>0&&<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{files.map((f,i)=><div key={f.name+i} className="relative aspect-square overflow-hidden rounded-xl bg-black/5">{f.type.startsWith("image/")?<img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover"/>:<video src={URL.createObjectURL(f)} className="h-full w-full object-cover"/>}<button type="button" onClick={()=>setFiles(v=>v.filter((_,n)=>n!==i))} className="absolute right-2 top-2 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-black/70 p-2 text-white" aria-label={`移除 ${f.name}`}><X size={14}/></button>{i===0&&<span className="absolute bottom-2 left-2 rounded bg-white/90 px-2 py-1 text-[10px]">封面</span>}</div>)}</div>}
      <div className="rounded-lg border border-black/10 bg-white p-4 text-xs leading-6 text-black/55" aria-live="polite"><p>本次文件：{formatBytes([...files,...technicalFiles].reduce((sum,file)=>sum+file.size,0))} / 100MB</p><p>{storage ? `账号已用 ${formatBytes(storage.used)}，剩余 ${formatBytes(storage.remaining)}（总额 300MB）` : "登录后可查看账号剩余空间"}</p><p>历史版本、私密和下架产品均计入空间。</p>{storage&&storage.siteRemaining<UPLOAD_LIMITS.product&&<p className="text-amber-700">全站上传空间紧张，当前最多还可上传 {formatBytes(storage.siteRemaining)}。</p>}</div>
      <TechnicalEditor notes={technicalNotes} links={technicalLinks} files={technicalFiles} disabled={!!progress} onNotes={setTechnicalNotes} onLinks={setTechnicalLinks} onFiles={setTechnicalFiles} onError={setError}/>
      {error&&<p className="text-sm text-red-600" role="alert">{error}</p>}
      {progress&&<p className="text-sm text-black/50" role="status" aria-live="polite">{progress}</p>}
      <button disabled={!!progress} className="min-h-12 w-full rounded-full bg-black px-5 py-3.5 text-base text-white disabled:opacity-50">{progress?"正在发布…":"发布作品"}</button>
    </form>
  </section>
</main>}
function Choice({label,items,value,set}:{label:string;items:string[];value:string;set:(x:string)=>void}){return <fieldset><legend className="mb-2 text-sm font-medium">{label}</legend><div className="flex flex-wrap gap-2">{items.map(x=><button type="button" key={x} onClick={()=>set(x)} className={`min-h-11 rounded-full border px-4 py-2 text-sm ${value===x?"border-black bg-black text-white":"border-black/15 bg-white text-black/55"}`}>{x}</button>)}</div></fieldset>}
