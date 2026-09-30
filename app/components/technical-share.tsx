"use client";
import { useState } from "react";
import { isWebResourceLink, resourceLinkTitle, type Technical } from "../lib/technical";

export default function TechnicalShare({ value }: { value?: Technical | null }) {
  const [copied, setCopied] = useState<number | null>(null);
  async function copy(value: string, index: number) {
    try { await navigator.clipboard.writeText(value); setCopied(index); window.setTimeout(() => setCopied(null), 1800); }
    catch { setCopied(null); }
  }
  if (!value || (!value.notes && !value.links?.length && !value.files?.length && !value.miniProgram?.name)) return null;
  return <>
    {value.miniProgram?.name && <section className="mt-8 rounded-xl border border-black/10 bg-white p-5" aria-label="微信小程序入口">
      <h2 className="text-lg font-semibold">微信小程序</h2>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-base font-medium">{value.miniProgram.name}</span><button type="button" onClick={() => void copy(value.miniProgram!.name, 90)} className="rounded-full border border-black/15 px-4 py-2 text-xs">{copied === 90 ? "名称已复制" : "复制名称"}</button></div>
      {value.miniProgram.originalId && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-black/55"><span className="break-all">原始 ID：{value.miniProgram.originalId}</span><button type="button" onClick={() => void copy(value.miniProgram!.originalId, 91)} className="rounded-full border border-black/15 px-3 py-1.5">{copied === 91 ? "已复制" : "复制 ID"}</button></div>}
      {value.miniProgram.qrObjectKey && <div className="mt-5 border-t border-black/10 pt-4"><p className="text-sm font-medium">微信扫码打开</p><img src={`/api/media/file?key=${encodeURIComponent(value.miniProgram.qrObjectKey)}`} alt={`${value.miniProgram.name}小程序码`} className="mt-3 size-48 rounded-lg border border-black/10 bg-white object-contain p-2" /></div>}
      <p className="mt-3 text-xs text-black/45">复制名称后可在微信搜索；也可使用微信扫一扫。</p>
    </section>}
    {(value.notes || value.links?.length || value.files?.length) && <section className="mt-8 min-w-0 border-t border-black/10 pt-6" aria-label="技术分享">
    <h2 className="text-lg font-semibold">技术分享</h2>
    {value.notes && <div className="mt-4 space-y-3">{value.notes.split(/(```[\s\S]*?```)/g).filter(Boolean).map((part,index) =>
      part.startsWith("```") ? <pre key={index} className="overflow-x-auto rounded-lg bg-[#20201e] p-4 text-xs leading-6 text-white/90"><code>{part.slice(3,-3).replace(/^[\w+-]*\r?\n/,"")}</code></pre> :
      <p key={index} className="whitespace-pre-wrap break-words text-sm leading-7 text-black/65">{part}</p>)}</div>}
    {!!value.links?.length && <div className="mt-5 space-y-2"><h3 className="text-xs font-medium text-black/45">资源链接</h3>{value.links.map((link,index) => isWebResourceLink(link.url) ? <a key={index} href={link.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-black/10 bg-white p-4 hover:border-black/35"><span className="break-words text-sm font-medium">{resourceLinkTitle(link.url)} ↗</span>{link.description && <p className="mt-1 break-words text-xs leading-5 text-black/50">{link.description}</p>}</a> : <div key={index} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/10 bg-white p-4"><div className="min-w-0"><span className="break-words text-sm font-medium">{resourceLinkTitle(link.url)}</span><p className="mt-1 break-all text-xs leading-5 text-black/50">{link.url}</p></div><button type="button" onClick={() => void copy(link.url,index)} className="shrink-0 rounded-full border border-black/15 px-4 py-2 text-xs hover:border-black/40">{copied === index ? "已复制" : "复制内容"}</button></div>)}</div>}
    {!!value.files?.length && <div className="mt-5 space-y-2"><h3 className="text-xs font-medium text-black/45">资料下载</h3>{value.files.map(file => <a key={file.object_key} href={`/api/technical/file?key=${encodeURIComponent(file.object_key)}`} className="flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-white p-4 text-sm hover:border-black/35"><span className="min-w-0 break-all">{file.name}</span><span className="shrink-0 text-xs text-black/45">{file.size >= 1048576 ? (file.size/1048576).toFixed(1)+" MB" : Math.max(1,Math.ceil(file.size/1024))+" KB"} · 下载</span></a>)}</div>}
    </section>}
  </>;
}
