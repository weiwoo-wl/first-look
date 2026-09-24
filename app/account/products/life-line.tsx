"use client";

import { ImageIcon, Play, X } from "lucide-react";
import { useState } from "react";
import VersionMediaGallery, { type VersionMedia } from "./version-media-gallery";

export type ProductVersion = {
  id: number; version_number: number; title: string; description: string; story: string;
  type: string; status: string; tags: string; product_url: string; change_note: string;
  created_at: string; media: VersionMedia[];
};
export type ProductEvent = {
  id: number; event_type: string; version_number: number | null; likes_total: number | null;
  detail: string; created_at: string;
};

const eventLabels: Record<string, string> = { unpublished: "产品已下架", republished: "产品重新上架", publicized: "产品公开上架" };

function formatDate(value: string) {
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function mediaUrl(key: string) { return `/api/media/file?key=${encodeURIComponent(key)}`; }

function VersionCover({ version, open }: { version: ProductVersion; open: boolean }) {
  const cover = version.media?.[0];
  return <span className="relative block h-16 w-16 shrink-0 overflow-hidden rounded-sm border border-black/10 bg-[#ecebe5] shadow-[0_7px_18px_rgba(0,0,0,.10)] transition-transform group-hover:-translate-y-0.5 group-focus-visible:-translate-y-0.5">
    {cover?.media_type === "video" ? <><video src={mediaUrl(cover.object_key)} muted preload="metadata" className="h-full w-full object-cover" /><span className="absolute inset-0 grid place-items-center bg-black/15 text-white"><Play size={18} fill="currentColor" /></span></> : cover ? <img src={mediaUrl(cover.object_key)} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center text-black/30"><ImageIcon size={20} /></span>}
    {open && <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black text-white"><X size={12} /></span>}
  </span>;
}

function VersionDetails({ version, likesAtRelease, currentLikes }: { version: ProductVersion; likesAtRelease: number | null; currentLikes: number }) {
  return <div className="mt-4 border-t border-black/10 pt-5">
    {version.media?.length > 0 && <VersionMediaGallery media={version.media} title={version.title} />}
    <div className="mt-5 grid gap-5 sm:grid-cols-[1fr_12rem]">
      <div><h3 className="text-lg font-semibold tracking-[-.035em]">{version.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-black/65">{version.description || "这次发布没有填写产品介绍。"}</p>{version.story && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-black/50"><span className="font-medium text-black/70">创作思路</span><br />{version.story}</p>}{version.change_note && <p className="mt-4 border-l-2 border-[#bd4b32] pl-3 text-sm leading-6 text-black/60">{version.change_note}</p>}</div>
      <dl className="space-y-3 text-xs"><div><dt className="text-black/40">版本</dt><dd className="mt-1 font-medium">第 {version.version_number} 次发布</dd></div><div><dt className="text-black/40">当时状态</dt><dd className="mt-1 font-medium">{version.status || "未填写"}</dd></div><div><dt className="text-black/40">喜欢</dt><dd className="mt-1 font-medium">发布时 {likesAtRelease ?? "—"} · 当前 {currentLikes}</dd></div>{version.tags && <div><dt className="text-black/40">标签</dt><dd className="mt-1 leading-5">{version.tags}</dd></div>}{version.product_url && <div><dt className="text-black/40">产品链接</dt><dd className="mt-1 break-all"><a href={version.product_url} target="_blank" rel="noreferrer" className="underline underline-offset-2">打开链接</a></dd></div>}</dl>
    </div>
  </div>;
}

export default function LifeLine({ versions, events, currentLikes }: { versions: ProductVersion[]; events: ProductEvent[]; currentLikes: number }) {
  const [selected, setSelected] = useState<number | null>(null);
  const likesAtRelease = new Map(events.filter((event) => ["published", "updated"].includes(event.event_type) && event.version_number !== null).map((event) => [event.version_number, event.likes_total]));
  const entries = [...versions.map((version) => ({ key: `v${version.id}`, date: version.created_at, kind: "version" as const, version })), ...events.filter((event) => eventLabels[event.event_type]).map((event) => ({ key: `e${event.id}`, date: event.created_at, kind: "event" as const, event }))].sort((a, b) => b.date.localeCompare(a.date));
  if (!entries.length) return <p className="py-6 text-sm text-black/45">完成首次发布后，这里会出现产品的生命线。</p>;
  return <div className="mt-7">
    <div className="grid grid-cols-[5.5rem_1.5rem_1fr] items-center sm:grid-cols-[9rem_2rem_1fr]"><span /><span className="mx-auto h-3 w-3 rounded-full border-2 border-[#f7f7f4] bg-[#bd4b32] ring-1 ring-[#bd4b32]" /><p className="text-xs font-semibold tracking-wide text-[#9a3f2c]">发布记录</p></div>
    <ol aria-label="产品生命线">{entries.map((entry, index) => {
      const isFirstRelease = entry.kind === "version" && entry.version.version_number === 1;
      const isOpen = entry.kind === "version" && selected === entry.version.id;
      return <li key={entry.key} className="grid grid-cols-[5.5rem_1.5rem_minmax(0,1fr)] sm:grid-cols-[9rem_2rem_minmax(0,1fr)]">
        <time className="pt-7 pr-3 text-right text-[10px] leading-4 text-black/40 sm:text-xs">{formatDate(entry.date)}</time>
        <div className="relative flex justify-center">{index < entries.length - 1 && <span className="absolute bottom-0 top-0 w-px bg-black/15" aria-hidden="true" />}<span className={`relative mt-8 h-2.5 w-2.5 rounded-full border-2 border-[#f7f7f4] ring-1 ring-black/35 ${isFirstRelease ? "bg-[#f7f7f4]" : "bg-[#292927]"}`} aria-hidden="true" /></div>
        {entry.kind === "version" ? <div className="min-w-0 py-4 pl-3 sm:pl-5"><button type="button" onClick={() => setSelected(isOpen ? null : entry.version.id)} aria-expanded={isOpen} aria-label={`${isOpen ? "收起" : "展开"}${formatDate(entry.date)}发布的第 ${entry.version.version_number} 个版本`} className="group rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-4"><VersionCover version={entry.version} open={isOpen} /></button>{isOpen && <VersionDetails version={entry.version} likesAtRelease={likesAtRelease.get(entry.version.version_number) ?? null} currentLikes={currentLikes} />}</div> : <div className="py-7 pl-3 sm:pl-5"><p className="text-xs font-medium text-black/55">{eventLabels[entry.event.event_type]}</p></div>}
      </li>;
    })}</ol>
  </div>;
}
