"use client";
import type { TechnicalLink } from "../lib/technical";
import { allowedTechnicalName, TECHNICAL_EXTENSIONS, TECHNICAL_MAX_SIZE } from "../lib/technical";
type Props = {notes:string;links:TechnicalLink[];files:File[];disabled:boolean;onNotes:(value:string)=>void;onLinks:(value:TechnicalLink[])=>void;onFiles:(value:File[])=>void;onError:(value:string)=>void};
const input = "w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-black/60";
export default function TechnicalEditor({notes,links,files,disabled,onNotes,onLinks,onFiles,onError}:Props) {
  function choose(list:FileList|null) {
    if (!list) return;
    const added = Array.from(list);
    if (files.length+added.length>5) {onError("技术资料最多 5 份");return;}
    if (added.some(file=>!file.size||file.size>TECHNICAL_MAX_SIZE||!allowedTechnicalName(file.name)||file.name.length>200)) {onError("请选择 10MB 以内的 MD、TXT、JSON、YAML、脚本或 ZIP 文件");return;}
    onError("");onFiles([...files,...added]);
  }
  return <fieldset disabled={disabled} className="space-y-5 rounded-xl border border-black/10 bg-[#eeeee8] p-5 disabled:opacity-60">
    <legend className="px-1 text-sm font-semibold">技术分享 <span className="font-normal text-black/45">（选填）</span></legend>
    <p className="text-xs leading-5 text-black/50">分享实现思路，也可以留下 Skill、代码或教程。可见范围与产品一致。</p>
    <label className="block text-sm"><span className="mb-2 block font-medium">实现思路</span><textarea value={notes} onChange={e=>onNotes(e.target.value)} maxLength={20000} rows={6} className={input} placeholder={"用了哪些工具？怎么实现的？\n可以直接粘贴文字；代码可用三个反引号包起来。"} /><span className="mt-1 block text-right text-xs text-black/35">{notes.length}/20000</span></label>
    <div className="space-y-3"><p className="text-sm font-medium">资源链接</p>{links.map((link,index)=><div key={index} className="space-y-2 rounded-lg border border-black/10 p-3">
      <label className="block text-xs">资源名称<input required maxLength={100} value={link.title} onChange={e=>onLinks(links.map((x,i)=>i===index?{...x,title:e.target.value}:x))} className={input+" mt-1"} placeholder="例如：产品调研 Skill" /></label>
      <label className="block text-xs">链接地址<input required type="url" maxLength={2048} value={link.url} onChange={e=>onLinks(links.map((x,i)=>i===index?{...x,url:e.target.value}:x))} className={input+" mt-1"} placeholder="https://" /></label>
      <label className="block text-xs">用途说明（选填）<input maxLength={500} value={link.description} onChange={e=>onLinks(links.map((x,i)=>i===index?{...x,description:e.target.value}:x))} className={input+" mt-1"} /></label>
      <button type="button" onClick={()=>onLinks(links.filter((_,i)=>i!==index))} className="text-xs text-red-700">移除这个链接</button>
    </div>)}{links.length<8&&<button type="button" onClick={()=>onLinks([...links,{title:"",url:"",description:""}])} className="rounded-full border border-black/15 bg-white px-4 py-2 text-xs">＋ 添加资源链接</button>}</div>
    <div className="space-y-2"><label className="block text-sm font-medium">资料文件<input type="file" multiple accept={TECHNICAL_EXTENSIONS.join(",")} onChange={e=>{choose(e.target.files);e.target.value="";}} className="mt-2 block w-full text-xs file:mr-3 file:rounded-full file:border file:border-black/15 file:bg-white file:px-4 file:py-2" /></label><p className="text-xs leading-5 text-black/45">SKILL.md、脚本、ZIP 等；最多 5 份，每份 10MB。文件以下载方式分享。</p>{files.map((file,index)=><div key={index} className="flex items-center justify-between gap-3 rounded-lg bg-white p-3 text-xs"><span className="break-all">{file.name}</span><button type="button" onClick={()=>onFiles(files.filter((_,i)=>i!==index))} className="shrink-0 text-red-700" aria-label={`移除 ${file.name}`}>移除</button></div>)}</div>
  </fieldset>;
}
