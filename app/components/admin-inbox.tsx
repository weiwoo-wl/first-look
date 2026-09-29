"use client";
import { useEffect, useRef, useState } from "react";

type Summary = { id: string; subject: string; from: string; fromAddress: string; date: string; unread: boolean };
type Message = Summary & { text: string; replyTo: string; attachments: string[] };
const dateLabel = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN"); };

export default function AdminInbox() {
  const [messages, setMessages] = useState<Summary[]>([]), [page, setPage] = useState(1), [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [total, setTotal] = useState(0), [hasMore, setHasMore] = useState(false);
  const [message, setMessage] = useState<Message | null>(null), [opening, setOpening] = useState(false), [detailError, setDetailError] = useState("");
  const [body, setBody] = useState(""), [sending, setSending] = useState(false), [replyStatus, setReplyStatus] = useState("");
  const requestRef = useRef<AbortController | null>(null), sendingRef = useRef(false);
  const replyDraft = useRef<{ id: string; body: string; batchId: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/admin/inbox?page=${page}`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json() as { error?: string; messages: Summary[]; total: number; hasMore: boolean }; if (!response.ok) throw Error(data.error || "无法打开收件箱");
      if (!controller.signal.aborted) { setMessages(data.messages); setTotal(data.total); setHasMore(data.hasMore); }
    }).catch(problem => { if (!controller.signal.aborted) setError(problem instanceof Error ? problem.message : "无法打开收件箱"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, version]);
  useEffect(() => () => requestRef.current?.abort(), []);
  function refresh(nextPage = page) { setLoading(true); setError(""); setPage(nextPage); setVersion(value => value + 1); }
  async function open(item: Summary) {
    if (sendingRef.current) return;
    if (body.trim() && !window.confirm("打开另一封邮件会清空尚未发送的回复，继续吗？")) return;
    requestRef.current?.abort(); const controller = new AbortController(); requestRef.current = controller;
    setMessage(null); setOpening(true); setDetailError(""); setBody(""); setReplyStatus(""); replyDraft.current = null;
    try {
      const response = await fetch(`/api/admin/inbox?id=${encodeURIComponent(item.id)}`, { cache: "no-store", signal: controller.signal });
      const data = await response.json() as { error?: string; message: Message }; if (!response.ok) throw Error(data.error || "无法读取邮件");
      if (!controller.signal.aborted) setMessage(data.message);
    } catch (problem) { if (!controller.signal.aborted) setDetailError(problem instanceof Error ? problem.message : "无法读取邮件"); }
    finally { if (!controller.signal.aborted) setOpening(false); }
  }
  async function reply() {
    if (!message || !body.trim() || sendingRef.current || replyStatus) return;
    if (!window.confirm(`回复给 ${message.replyTo}？\n主题：Re: ${message.subject}`)) return;
    const draft = replyDraft.current || { id: message.id, body: body.trim(), batchId: crypto.randomUUID() }; replyDraft.current = draft;
    sendingRef.current = true; setSending(true); setDetailError("");
    try {
      const response = await fetch("/api/admin/inbox/reply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const data = await response.json() as { error?: string; status: string }; if (!response.ok) throw Error(data.error || "无法发送回复");
      setReplyStatus(data.status);
      window.dispatchEvent(new Event("firstlook-mail-sent"));
    } catch (problem) { setDetailError(problem instanceof Error ? problem.message : "发送结果暂不确定，请重试查询；同一回复不会重复发送"); }
    finally { sendingRef.current = false; setSending(false); }
  }
  return <section className="admin-panel">
    <div className="admin-panel-title"><h2>收件箱</h2><span>server@firstlooklab.cn</span></div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 p-5"><p className="text-xs text-black/50">共 {total} 封 · 只读查看，不改变阿里邮箱里的已读状态</p><button type="button" disabled={loading} onClick={()=>refresh()} className="text-sm underline disabled:opacity-40">刷新收件箱</button></div>
    <div className="grid gap-6 p-5 lg:grid-cols-[minmax(240px,1fr)_minmax(0,2fr)]">
      <div>{loading?<p role="status" className="text-sm text-black/50">正在读取来信…</p>:error?<p role="alert" className="text-sm text-red-600">{error}</p>:messages.length?<div className="space-y-2">{messages.map(item=><button type="button" key={item.id} disabled={sending} onClick={()=>void open(item)} aria-pressed={message?.id===item.id} className={`block w-full rounded-lg border p-3 text-left disabled:opacity-40 ${message?.id===item.id?"border-black bg-black/5":"border-black/10"}`}><span className="block break-words text-sm font-medium">{item.unread?"● ":""}{item.subject}</span><span className="mt-1 block break-all text-xs text-black/60">{item.from}</span><time className="mt-1 block text-xs text-black/45">{dateLabel(item.date)}</time></button>)}</div>:<p className="text-sm text-black/50">收件箱暂时没有邮件</p>}
        <div className="mt-4 flex items-center justify-between text-sm"><button type="button" disabled={loading||page===1} onClick={()=>refresh(page-1)} className="disabled:opacity-30">上一页</button><span>第 {page} 页</span><button type="button" disabled={loading||!hasMore} onClick={()=>refresh(page+1)} className="disabled:opacity-30">下一页</button></div>
      </div>
      <div className="min-w-0">{opening?<p role="status" className="text-sm text-black/50">正在打开邮件…</p>:message?<>
        <h3 className="break-words text-lg font-semibold">{message.subject}</h3><p className="mt-2 break-all text-xs text-black/60">发件人：{message.from} &lt;{message.fromAddress}&gt;<br />{dateLabel(message.date)}</p>
        <div className="my-5 max-h-[480px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/5 p-4 text-sm leading-7">{message.text||"这封邮件没有可显示的文字正文"}</div>
        {message.attachments.length>0&&<p className="mb-4 break-words text-xs text-black/50">附件：{message.attachments.join("、")}。请到阿里邮箱查看或下载附件。</p>}
        <p className="mb-3 break-all text-xs text-black/50">回复给：{message.replyTo||"无可回复地址"} · 发件人：server@firstlooklab.cn</p>
        <label className="block text-sm font-medium">回复正文<textarea rows={6} maxLength={10000} value={body} disabled={sending||Boolean(replyStatus)} onChange={event=>{setBody(event.target.value);replyDraft.current=null;}} className="mt-2 block w-full rounded-lg border border-black/15 px-3 py-2 font-normal" /></label>
        <button type="button" disabled={sending||!body.trim()||!message.replyTo||Boolean(replyStatus)} onClick={()=>void reply()} className="mt-3 rounded-full bg-black px-5 py-3 text-sm text-white disabled:opacity-40">{sending?"正在回复…":"发送回复"}</button>
        {replyStatus&&<p role="status" className="mt-3 text-sm">{replyStatus==="sent"?"回复已提交发送，可在发送记录查看。":replyStatus==="failed"?"回复发送失败或结果不确定，未自动重发。请先检查发送记录及阿里邮箱。":"回复正在处理，请勿重新发送。"}</p>}
      </>:<p className="text-sm text-black/50">选择左侧来信，查看正文并回复。</p>}
      {detailError&&<p role="alert" className="mt-3 text-sm text-red-600">{detailError}</p>}</div>
    </div>
  </section>;
}
