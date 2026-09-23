"use client";
import { useState } from "react";

type Media = { object_key: string; media_type: string };
type Version = { id: number; version_number: number; title: string; description: string; story: string; type: string; status: string; tags: string; product_url: string; change_note: string; created_at: string; media: Media[] };
type Event = { id: number; event_type: string; version_number: number | null; likes_total: number | null; detail: string; created_at: string };
const labels: Record<string, string> = { published: "首次发布", updated: "内容更新", unpublished: "下架", republished: "重新上架", liked: "收到喜欢", unliked: "有人取消喜欢" };

export default function LifeLine({ versions, events }: { versions: Version[]; events: Event[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const entries = [
    ...versions.map((version) => ({ key: `v${version.id}`, date: version.created_at, kind: version.version_number === 1 ? "published" : "updated", version })),
    ...events.filter((event) => !["published", "updated"].includes(event.event_type)).map((event) => ({ key: `e${event.id}`, date: event.created_at, kind: event.event_type, event })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  if (!entries.length) return <p className="text-sm text-black/45">还没有发展记录。</p>;
  return <ol className="relative ml-2 border-l border-black/15 pl-7" aria-label="产品发展时间线">
    {entries.map((entry, index) => <li key={entry.key} className="relative pb-7 last:pb-1">
      <span className={`absolute -left-[35px] top-1 h-3 w-3 rounded-full border-2 border-[#fafaf8] ${entry.kind === "liked" ? "bg-[#e15d36]" : "bg-black"}`} />
      <p className="text-xs font-semibold text-black/45">{labels[entry.kind] || entry.kind} · {entry.date}</p>
      {"version" in entry && <><button onClick={() => setSelected(selected === entry.version.id ? null : entry.version.id)} aria-expanded={selected === entry.version.id} className="mt-2 text-left font-medium underline decoration-black/20 underline-offset-4">版本 {entry.version.version_number}：{entry.version.title}</button>
        {selected === entry.version.id && <div className="mt-3 space-y-3 rounded-xl border border-black/10 bg-white p-4"><p className="text-sm leading-6 text-black/65">{entry.version.description}</p>{entry.version.story && <p className="text-sm leading-6 text-black/50">创作思路：{entry.version.story}</p>}{entry.version.change_note && <p className="text-xs text-[#a54b31]">本次变化：{entry.version.change_note}</p>}<p className="text-xs text-black/40">{entry.version.type} · {entry.version.status}{entry.version.tags ? ` · ${entry.version.tags}` : ""}{entry.version.product_url ? ` · ${entry.version.product_url}` : ""}</p>{entry.version.media?.length > 0 && <div className="grid grid-cols-3 gap-2">{entry.version.media.map((media) => <div key={media.object_key} className="aspect-square overflow-hidden rounded-lg bg-black/5">{media.media_type === "video" ? <video src={`/api/media/file?key=${encodeURIComponent(media.object_key)}`} controls className="h-full w-full object-cover" /> : <img src={`/api/media/file?key=${encodeURIComponent(media.object_key)}`} alt="该版本的产品图片" className="h-full w-full object-cover" />}</div>)}</div>}</div>}
      </>}
      {"event" in entry && <p className="mt-1 text-sm text-black/55">{entry.event.detail}{entry.event.likes_total !== null ? ` · 当前喜欢 ${entry.event.likes_total}` : ""}</p>}
      {index === entries.length - 1 && <span className="mt-3 block text-[11px] text-black/35">当前</span>}
    </li>)}
  </ol>;
}
