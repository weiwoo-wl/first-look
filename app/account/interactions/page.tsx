"use client";

import { ArrowLeft, Flag, Heart, RefreshCw, Share2, Star } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type RecordItem = { id: number; creation_id?: number; target_id?: string; slug?: string | null; title?: string | null; creator_name?: string | null; visibility?: string | null; created_at: string; source?: string; reason?: string; detail?: string; status?: string };
type Data = { likes: RecordItem[]; favorites: RecordItem[]; shares: RecordItem[]; reports: RecordItem[] };
type Tab = keyof Data;

const tabs: { id: Tab; label: string; icon: typeof Heart }[] = [
  { id: "likes", label: "我的喜欢", icon: Heart },
  { id: "favorites", label: "我的收藏", icon: Star },
  { id: "shares", label: "我的转发", icon: Share2 },
  { id: "reports", label: "我的举报", icon: Flag },
];
const emptyData: Data = { likes: [], favorites: [], shares: [], reports: [] };

function dateLabel(value: string) {
  const date = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function visibilityLabel(value?: string | null) {
  if (value === "published") return "上架中";
  if (value === "admin_hidden") return "审核中";
  if (value === "unpublished") return "已下架";
  if (value === "private") return "仅自己可见";
  return value ? "暂不可访问" : "产品已删除";
}

export default function InteractionsPage() {
  const [data, setData] = useState<Data>(emptyData);
  const [tab, setTab] = useState<Tab>("likes");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/account/interactions");
      if (response.status === 401) { location.replace("/login?next=/account/interactions"); return; }
      const result = await response.json() as Data & { error?: string };
      if (!response.ok) throw new Error(result.error || "互动记录暂时无法读取");
      setData(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "互动记录暂时无法读取");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function removeFromList(kind:"likes"|"favorites",creationId:number) {
    setRemoving(`${kind}:${creationId}`);setNotice("");
    try {
      const response=await fetch("/api/account/interactions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({creationId,action:kind==="likes"?"remove-like":"remove-favorite"})});
      const result=await response.json();
      if(!response.ok)throw Error(result.error||"移出失败");
      setData(current=>({...current,[kind]:current[kind].filter(item=>item.creation_id!==creationId)}));
      setNotice("已移出列表，历史互动计数保留。");
    }catch(problem){setNotice(problem instanceof Error?problem.message:"移出失败，请重试");}
    finally{setRemoving("");}
  }

  const items = data[tab] || [];
  const title = tabs.find((item) => item.id === tab)?.label || "我的互动";

  return <main className="min-h-dvh bg-[#f7f7f4] px-5 py-10 text-[#171717]"><section className="mx-auto max-w-3xl">
    <a href="/account" className="inline-flex min-h-11 items-center gap-2 text-sm text-black/50"><ArrowLeft size={16} />创作者中心</a>
    <p className="mt-8 text-sm text-black/45">互动记录</p><h1 className="mt-2 text-4xl font-semibold tracking-[-.06em]">我的互动</h1>
    {notice&&<p role="status" className="mt-3 text-sm text-black/55">{notice}</p>}
    <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4" role="tablist" aria-label="互动类型">{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-3 text-sm ${tab === id ? "border-black bg-black text-white" : "border-black/12 bg-white text-black/65"}`}><Icon size={15} />{label}</button>)}</div>
    <section className="mt-6 min-h-64 border-y border-black/10" aria-label={title}>
      {loading ? <div className="space-y-3 py-7" aria-busy="true"><div className="h-16 animate-pulse bg-black/[.04]"/><div className="h-16 animate-pulse bg-black/[.04]"/></div> : error ? <div className="py-10 text-center"><p role="alert" className="text-sm text-red-700">{error}</p><button type="button" onClick={() => void load()} className="mt-4 inline-flex items-center gap-2 text-sm underline underline-offset-4"><RefreshCw size={14} />重新读取</button></div> : items.length ? <ul className="divide-y divide-black/10">{items.map((item) => {
        const available = item.visibility === "published" && Boolean(item.slug);
        return <li key={`${tab}-${item.id}`} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-base font-semibold">{item.title || "产品已删除"}</p><p className="mt-1 text-xs text-black/45">{item.creator_name ? `由 ${item.creator_name} 发布 · ` : ""}{dateLabel(item.created_at)}</p>{tab === "reports" && <><p className="mt-2 text-xs text-black/55">{item.reason} · {item.status === "pending" ? "待处理" : "已处理"}</p>{item.detail && <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-black/50">{item.detail}</p>}</>}{tab === "shares" && <p className="mt-2 text-xs text-black/45">{item.source === "native-share" ? "系统分享" : "分享链接"}</p>}</div><div className="flex shrink-0 items-center gap-3"><span className={`text-xs ${available ? "text-emerald-700" : "text-black/40"}`}>{visibilityLabel(item.visibility)}</span>{(tab==="likes"||tab==="favorites")&&item.creation_id&&<button type="button" disabled={Boolean(removing)} onClick={()=>void removeFromList(tab,item.creation_id!)} className="text-xs text-black/45 underline underline-offset-4">{removing===`${tab}:${item.creation_id}`?"正在移出…":"移出列表"}</button>}{available && <Link href={`/work/${encodeURIComponent(item.slug!)}`} className="text-sm underline underline-offset-4">查看产品</Link>}</div></li>;
      })}</ul> : <div className="grid min-h-64 place-items-center py-12 text-center"><div><p className="text-sm text-black/50">{tab === "reports" ? "你还没有提交举报。" : tab === "shares" ? "登录后分享的产品会记录在这里。" : "这里还没有记录。"}</p>{tab !== "reports" && <Link href="/" className="mt-4 inline-block text-sm underline underline-offset-4">去发现产品</Link>}</div></div>}
    </section>
  </section></main>;
}
