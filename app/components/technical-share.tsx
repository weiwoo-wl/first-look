"use client";
import { useState } from "react";
import { isWebResourceLink, resourceLinkTitle, type Technical } from "../lib/technical";

export default function TechnicalShare({ value }: { value?: Technical | null }) {
  const [copied, setCopied] = useState<number | null>(null);
  async function copy(value: string, index: number) {
    try { await navigator.clipboard.writeText(value); setCopied(index); window.setTimeout(() => setCopied(null), 1800); }
    catch { setCopied(null); }
  }
  if (!value || (!value.notes && !value.links?.length && !value.files?.length)) return null;
  return <section className="mt-8 min-w-0 border-t border-black/10 pt-6" aria-label="技术分享">
    <h2 className="text-lg font-semibold">技术分享</h2>
    {value.notes && <div className="mt-4 space-y-3">{value.notes.split(/(```[\s\S]*?```)/g).filter(Boolean).map((part,index) =>
      part.startsWith("```") ? <pre key={index} className="overflow-x-auto rounded-lg bg-[#20201e] p-4 text-xs leading-6 text-white/90"><code>{part.slice(3,-3).replace(/^[\w+-]*\r?\n/,"")}</code></pre> :
      <p key={index} className="whitespace-pre-wrap break-words text-sm leading-7 text-black/65">{part}</p>)}</div>}
    {!!value.links?.length && <div className="mt-5 space-y-2"><h3 className="text-xs font-medium text-black/45">资源链接</h3>{value.links.map((link,index) => isWebResourceLink(link.url) ? <a key={index} href={link.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-black/10 bg-white p-4 hover:border-black/35"><span className="break-words text-sm font-medium">{link.title || resourceLinkTitle(link.url)} ↗</span>{link.description && <p className="mt-1 break-words text-xs leading-5 text-black/50">{link.description}</p>}</a> : <div key={index} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/10 bg-white p-4"><div className="min-w-0"><span className="break-words text-sm font-medium">{link.title || resourceLinkTitle(link.url)}</span><p className="mt-1 break-all text-xs leading-5 text-black/50">{link.url}</p></div><button type="button" onClick={() => void copy(link.url,index)} className="shrink-0 rounded-full border border-black/15 px-4 py-2 text-xs hover:border-black/40">{copied === index ? "已复制" : "复制内容"}</button></div>)}</div>}
    {!!value.files?.length && <div className="mt-5 space-y-2"><h3 className="text-xs font-medium text-black/45">资料下载</h3>{value.files.map(file => <a key={file.object_key} href={`/api/technical/file?key=${encodeURIComponent(file.object_key)}`} className="flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-white p-4 text-sm hover:border-black/35"><span className="min-w-0 break-all">{file.name}</span><span className="shrink-0 text-xs text-black/45">{file.size >= 1048576 ? (file.size/1048576).toFixed(1)+" MB" : Math.max(1,Math.ceil(file.size/1024))+" KB"} · 下载</span></a>)}</div>}
  </section>;
}
