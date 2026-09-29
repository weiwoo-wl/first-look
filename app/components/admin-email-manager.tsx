"use client";
import { useMemo, useRef, useState } from "react";

type User = { id: string; email: string; display_name: string; disabled_at: string | null };
type Delivery = { userId: string; email: string; status: string };
const statusLabel: Record<string, string> = { sent: "已提交发送", failed: "发送失败", sending: "发送中，暂勿重发", unavailable: "账号不可用", pending: "待发送" };

export default function AdminEmailManager({ users }: { users: User[] }) {
  const [selected, setSelected] = useState<string[]>([]), [query, setQuery] = useState("");
  const [subject, setSubject] = useState(""), [body, setBody] = useState("");
  const [sending, setSending] = useState(false), [error, setError] = useState(""), [results, setResults] = useState<Delivery[]>([]);
  const [interrupted, setInterrupted] = useState(false);
  const sendingRef = useRef(false);
  const draft = useRef<{ batchId: string; ids: string[]; subject: string; body: string } | null>(null);
  const visible = useMemo(() => users.filter(user => `${user.display_name} ${user.email}`.toLowerCase().includes(query.toLowerCase())), [users, query]);
  const eligible = visible.filter(user => !user.disabled_at);
  const allSelected = eligible.length > 0 && eligible.every(user => selected.includes(user.id));
  const sent = results.filter(item => item.status === "sent").length;
  function toggle(id: string) { setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]); draft.current = null; setInterrupted(false); }
  async function send() {
    if (sendingRef.current || !selected.length || !subject.trim() || !body.trim()) return;
    if (!window.confirm(`向选中的 ${selected.length} 位用户分别发送这封邮件？\n主题：${subject.trim()}`)) return;
    const current = draft.current || { batchId: crypto.randomUUID(), ids: [...selected], subject: subject.trim(), body: body.trim() };
    draft.current = current;
    sendingRef.current = true; setSending(true); setError("");
    setResults(current.ids.map(userId => ({ userId, email: users.find(user => user.id === userId)?.email || "", status: "pending" })));
    let complete = false;
    try {
      for (let index = 0; index < current.ids.length; index += 5) {
        const response = await fetch("/api/admin/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipientIds: current.ids.slice(index,index+5), subject: current.subject, body: current.body, batchId: current.batchId }) });
        const data = await response.json() as { results?: Delivery[]; error?: string };
        if (!response.ok || !data.results) throw new Error(data.error || "发送中断，请点击继续发送；已处理的邮件不会重复发送");
        const received = data.results;
        setResults(previous => previous.map(item => received.find(result => result.userId === item.userId) || item));
      }
      complete = true;
    } catch (problem) { setInterrupted(true); setError(problem instanceof Error ? problem.message : "发送中断，请点击继续发送"); }
    finally { sendingRef.current = false; setSending(false); if (complete) { draft.current = null; setSelected([]); setInterrupted(false); } }
  }
  return <section className="admin-panel">
    <div className="admin-panel-title"><h2>发送邮件</h2><span>每位用户单独收到</span></div>
    <div className="grid gap-6 p-5 lg:grid-cols-2">
      <div><label className="block text-sm font-medium" htmlFor="mail-user-search">选择收件人</label>
        <input id="mail-user-search" type="search" value={query} disabled={sending} onChange={event=>setQuery(event.target.value)} placeholder="搜索姓名或邮箱" className="mt-3 w-full rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <label className="my-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={allSelected} disabled={sending || !eligible.length} onChange={()=>{setSelected(current=>allSelected?current.filter(id=>!eligible.some(user=>user.id===id)):[...new Set([...current,...eligible.map(user=>user.id)])]);draft.current=null;setInterrupted(false);}} />全选当前列表 <span className="text-black/45">已选 {selected.length} 人</span></label>
        <div className="max-h-96 overflow-auto rounded-lg border border-black/10">{visible.map(user=><label key={user.id} className="flex items-center gap-3 border-b border-black/5 p-3 last:border-0"><input type="checkbox" checked={selected.includes(user.id)} disabled={sending || Boolean(user.disabled_at)} onChange={()=>toggle(user.id)} /><span className="min-w-0"><b className="block text-sm">{user.display_name}</b><span className="block break-all text-xs text-black/50">{user.email}{user.disabled_at?" · 已禁用":""}</span></span></label>)}{!visible.length&&<p className="p-4 text-sm text-black/50">没有找到用户</p>}</div>
      </div>
      <div className="space-y-4"><label className="block text-sm font-medium">邮件主题<input value={subject} maxLength={160} disabled={sending} onChange={event=>{setSubject(event.target.value);draft.current=null;setInterrupted(false);}} className="mt-2 block w-full rounded-lg border border-black/15 px-3 py-2 font-normal" /></label>
        <label className="block text-sm font-medium">邮件正文<textarea value={body} maxLength={10000} rows={11} disabled={sending} onChange={event=>{setBody(event.target.value);draft.current=null;setInterrupted(false);}} className="mt-2 block w-full rounded-lg border border-black/15 px-3 py-2 font-normal" /></label>
        <p className="text-xs text-black/50">发件人：First Look · noreply@mail.firstlooklab.cn<br />正文末尾会附上联系邮箱 server@firstlooklab.cn。</p>
        <button type="button" className="rounded-full bg-black px-5 py-3 text-sm text-white disabled:opacity-40" disabled={sending || !selected.length || !subject.trim() || !body.trim()} onClick={()=>void send()}>{sending?`正在发送（已提交 ${sent} 封）`:interrupted?"继续发送":"发送给选中的用户"}</button>
        {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
        {results.length>0&&<div role="status" className="rounded-lg border border-black/10 p-3"><p className="mb-2 text-sm font-medium">已提交 {sent} 封 / 共 {results.length} 封</p>{results.map(item=><p key={item.userId} className="break-all py-1 text-xs">{item.email} · {statusLabel[item.status]||item.status}</p>)}</div>}
      </div>
    </div>
  </section>;
}
