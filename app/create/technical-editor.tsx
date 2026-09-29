"use client";
import { HelpCircle } from "lucide-react";
import { useState } from "react";
import type { TechnicalLink } from "../lib/technical";
import { allowedTechnicalName, TECHNICAL_EXTENSIONS, TECHNICAL_MAX_SIZE } from "../lib/technical";
type Props = {notes:string;links:TechnicalLink[];files:File[];disabled:boolean;onNotes:(value:string)=>void;onLinks:(value:TechnicalLink[])=>void;onFiles:(value:File[])=>void;onError:(value:string)=>void};
const input = "w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-base outline-none focus:border-black/60 sm:text-sm";
export default function TechnicalEditor({notes,links,files,disabled,onNotes,onLinks,onFiles,onError}:Props) {
  const [resourceHelpOpen, setResourceHelpOpen] = useState(false);
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
    <div className="space-y-3"><div className="flex items-center gap-1.5"><p className="text-sm font-medium">补充资源链接（选填）</p><button type="button" onClick={()=>setResourceHelpOpen(open=>!open)} aria-expanded={resourceHelpOpen} aria-label="查看补充资源链接说明" title="查看填写说明" className="grid size-6 place-items-center rounded-full text-black/45 transition hover:bg-white hover:text-black"><HelpCircle size={16}/></button></div><p className="text-xs text-black/45">可放代码、教程、文档，或 EXE／安装包／Skill 的下载链接。</p>{resourceHelpOpen&&<div role="note" className="rounded-lg border border-black/10 bg-white px-4 py-3 text-xs leading-6 text-black/65"><p>这里可以分享别人进一步了解、体验或下载你作品的链接，例如：</p><ul className="mt-1 list-disc space-y-0.5 pl-4"><li>GitHub 项目或代码仓库</li><li>在线演示、产品介绍页</li><li>使用教程、项目文档</li><li>EXE、安装包或 Skill 的下载页面（例如 GitHub Releases）</li><li>App、小程序或其他平台的分享链接／口令</li></ul><p className="mt-2">每条只需粘贴链接或口令，不必填写资源名称和用途说明；可以添加多条。网页链接会直接打开，可识别的 App 跳转链接会尝试打开对应应用；像 <span className="font-medium">#小程序://...</span> 这样的分享口令会提供复制，再到对应平台打开。</p><p className="mt-2">如果作品有网页体验，主入口放体验地址，安装包或 Skill 下载链接放在这里；访客可在作品详情页打开。</p></div>}{links.map((link,index)=><div key={index} className="space-y-2 rounded-lg border border-black/10 p-3">
      <label className="block text-xs">链接或口令<input type="text" maxLength={2048} value={link.url} onChange={e=>onLinks(links.map((x,i)=>i===index?{...x,url:e.target.value}:x))} className={input+" mt-1"} placeholder="粘贴网页链接、小程序口令等" /></label>
      <button type="button" onClick={()=>onLinks(links.filter((_,i)=>i!==index))} className="text-xs text-red-700">移除这个链接</button>
    </div>)}{links.length<8&&<button type="button" onClick={()=>onLinks([...links,{title:"",url:"",description:""}])} className="rounded-full border border-black/15 bg-white px-4 py-2 text-xs">＋ 添加资源链接</button>}</div>
    <div className="space-y-2"><label className="block text-sm font-medium">资料文件<input type="file" multiple accept={TECHNICAL_EXTENSIONS.join(",")} onChange={e=>{choose(e.target.files);e.target.value="";}} className="mt-2 block w-full text-base sm:text-xs file:mr-3 file:rounded-full file:border file:border-black/15 file:bg-white file:px-4 file:py-2" /></label><p className="text-xs leading-5 text-black/45">SKILL.md、脚本、ZIP 等；最多 5 份，每份 10MB。文件以下载方式分享。</p>{files.map((file,index)=><div key={index} className="flex items-center justify-between gap-3 rounded-lg bg-white p-3 text-xs"><span className="break-all">{file.name}</span><button type="button" onClick={()=>onFiles(files.filter((_,i)=>i!==index))} className="min-h-11 shrink-0 px-3 text-red-700" aria-label={`移除 ${file.name}`}>移除</button></div>)}</div>
  </fieldset>;
}
