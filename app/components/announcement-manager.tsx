"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Announcement } from "../lib/announcements";
const empty = { title: "", content: "", url: "", status: "published" as const };

export default function AnnouncementManager() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [form, setForm] = useState<Omit<Announcement, "id"> & { id?: number }>(empty);
  const [busy, setBusy] = useState(false);
  const [busyFor, setBusyFor] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  async function load() {
    const response = await fetch("/api/announcements?manage=1", { cache: "no-store" });
    if (!response.ok) throw Error("无法读取公告，请稍后重试");
    setItems((await response.json() as { announcements: Announcement[] }).announcements);
  }
  useEffect(() => { load().catch(problem => setError(problem.message)); }, []);
  async function save(value: typeof form) {
    setBusy(true); setBusyFor(value.id ?? null); setError(""); setMessage("");
    try {
      const response = await fetch("/api/announcements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw Error(result.error || "保存失败");
      setForm(empty); await load(); setMessage(value.status === "published" ? "公告已发布，首页刷新后即可看到。" : "公告已下架。");
    } catch (problem) { setError(problem instanceof Error ? problem.message : "保存失败"); }
    finally { setBusy(false); setBusyFor(null); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void save(form); }
  return <section className="admin-panel announcement-manager">
    <div className="admin-panel-title"><h2>{form.id ? "编辑公告" : "发布公告"}</h2><span>仅站长和管理员可发布</span></div>
    <form ref={formRef} onSubmit={submit} className="announcement-form">
      <label>标题<input required maxLength={40} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="例如：欢迎来到一眼" /></label>
      <label>内容<textarea required maxLength={240} rows={3} value={form.content} onChange={event => setForm({ ...form, content: event.target.value })} placeholder="写一条简短公告" /></label>
      <label>链接（选填）<input type="url" maxLength={2000} value={form.url || ""} onChange={event => setForm({ ...form, url: event.target.value })} placeholder="https://" /></label>
      <div className="announcement-form-actions"><label><input type="checkbox" checked={form.status === "published"} onChange={event => setForm({ ...form, status: event.target.checked ? "published" : "unpublished" })} />在首页展示</label><button disabled={busy} type="submit">{busy ? "正在保存…" : form.id ? "保存修改" : "保存公告"}</button>{form.id && <button disabled={busy} type="button" onClick={() => setForm(empty)}>取消编辑</button>}</div>
      {error && <p role="alert" className="text-red-700">{error}</p>}{message && <p role="status">{message}</p>}
    </form>
<div className="announcement-admin-list">{items.length ? items.map(item => <article key={item.id}><div><span className={`admin-status ${item.status === "unpublished" ? "warning" : ""}`}>{item.status === "published" ? "已发布" : "已下架"}</span><h3>{item.title}</h3><p>{item.content}</p>{item.url && <a href={item.url} target="_blank" rel="noopener noreferrer">{item.url}</a>}</div><div className="admin-row-actions"><button type="button" disabled={busy} onClick={() => { setForm(item); setMessage(""); setError(""); requestAnimationFrame(() => { formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); formRef.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true }); }); }}>编辑</button><button type="button" disabled={busy} onClick={() => void save({ ...item, status: item.status === "published" ? "unpublished" : "published" })}>{busyFor === item.id ? "正在更新…" : item.status === "published" ? "下架" : "发布"}</button></div>{busyFor === item.id && <span className="announcement-row-feedback" role="status">正在更新公告…</span>}</article>) : <p className="admin-empty">还没有公告，发布后会显示在首页 slogan 下方。</p>}</div>
  </section>;
}
