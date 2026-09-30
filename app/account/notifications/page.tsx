"use client";

import { ArrowLeft, Bell, CheckCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Notice = { id: number; type: "announcement" | "product"; title: string; summary: string; url: string | null; created_at: string; read_at: string | null };

export default function NotificationsPage() {
  const [items, setItems] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (response.status === 401) { location.replace("/login?next=/account/notifications"); return; }
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "通知暂时无法读取，请稍后重试");
      setError("");
      setItems(data.notifications || []);
      setUnread(Number(data.unread) || 0);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "通知暂时无法读取，请稍后重试");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function markRead(id?: number) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { id } : { all: true }) });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "标记失败，请重试");
      const now = new Date().toISOString();
      setItems(current => current.map(item => (!id || item.id === id) ? { ...item, read_at: item.read_at || now } : item));
      setUnread(Number(data.unread) || 0);
    } catch (problem) { setError(problem instanceof Error ? problem.message : "标记失败，请重试"); }
    finally { setBusy(false); }
  }

  return <main className="min-h-dvh bg-[#f7f7f4] px-5 py-8 text-[#171717]"><section className="mx-auto max-w-3xl">
    <div className="flex items-center justify-between gap-4"><a href="/account" className="inline-flex min-h-11 items-center gap-2 text-sm text-black/50"><ArrowLeft size={16}/>创作者中心</a><button type="button" disabled={!unread || busy} onClick={() => void markRead()} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-black/15 bg-white px-4 text-sm disabled:opacity-40"><CheckCheck size={16}/>全部标为已读</button></div>
    <div className="mt-8"><p className="text-sm text-black/45">创作者中心</p><h1 className="mt-2 flex items-center gap-3 text-4xl font-semibold tracking-[-.06em]">通知中心{unread > 0 && <span className="size-2.5 rounded-full bg-red-500" aria-label="有未读通知"/>}</h1><p className="mt-3 text-sm text-black/50">平台公告和与你的产品有关的重要消息。</p></div>
    {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error} <button type="button" onClick={() => { setLoading(true); void load(); }} className="ml-2 underline">重试</button></p>}
    {loading ? <p className="mt-8 text-sm text-black/45">正在读取通知…</p> : items.length ? <div className="mt-7 divide-y divide-black/10 border-y border-black/10">{items.map(item => {
      const safeUrl = item.url && (item.url.startsWith("/") && !item.url.startsWith("//") || /^https?:\/\//i.test(item.url)) ? item.url : null;
      return <article key={item.id} className={`py-5 ${item.read_at ? "" : "bg-white/60"}`}><div className="flex items-start gap-3"><span className={`mt-1.5 size-2 shrink-0 rounded-full ${item.read_at ? "bg-transparent" : "bg-red-500"}`} aria-hidden="true"/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><h2 className="font-semibold">{item.title}</h2><time className="text-xs text-black/40">{new Date(item.created_at.replace(" ", "T") + (item.created_at.endsWith("Z") ? "" : "Z")).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</time></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-black/60">{item.summary}</p><div className="mt-3 flex items-center gap-4">{safeUrl && <a href={safeUrl} target={safeUrl.startsWith("http") ? "_blank" : undefined} rel={safeUrl.startsWith("http") ? "noopener noreferrer" : undefined} className="text-sm font-medium underline underline-offset-4">查看相关内容 ↗</a>}{!item.read_at && <button type="button" disabled={busy} onClick={() => void markRead(item.id)} className="text-sm text-black/50 underline underline-offset-4 disabled:opacity-40">标为已读</button>}</div></div></div></article>;
    })}</div> : !error && <div className="mt-8 rounded-2xl border border-black/10 bg-white px-5 py-12 text-center"><Bell className="mx-auto text-black/25" size={28}/><p className="mt-3 text-sm text-black/50">暂时没有通知</p></div>}
  </section></main>;
}
