"use client";

import { ExternalLink, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Props = {
  id: number;
  slug: string;
  title: string;
  visibility: string;
  onVisibilityChange: (next: string) => void;
  onDeleted: () => void;
};

export default function ProductControls({ id, slug, title, visibility, onVisibilityChange, onDeleted }: Props) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirming) return;
    cancelRef.current?.focus();
    const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) setConfirming(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [busy, confirming]);

  async function request(action: "unpublish" | "republish" | "publicize" | "delete") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/creations/manage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creationId: id, action }) });
      const text = await response.text();
      let result: { error?: string; visibility?: string } = {};
      try { result = text ? JSON.parse(text) : {}; } catch {}
      if (!response.ok && !result.error) result.error = response.status >= 500 ? "服务器暂时无法完成操作，请稍后重试" : "操作失败";
      if (!response.ok) throw Error(result.error || "操作失败");
      if (action === "delete") onDeleted();
      else if (result.visibility) onVisibilityChange(result.visibility);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <div className="flex flex-wrap items-center gap-2">
      {["published", "private", "unpublished"].includes(visibility) && <button disabled={busy} onClick={() => void request(visibility === "published" ? "unpublish" : visibility === "private" ? "publicize" : "republish")} className="rounded-full border border-black/12 px-3 py-2 text-xs disabled:opacity-50">{busy ? "处理中…" : visibility === "published" ? "下架产品" : visibility === "private" ? "公开上架" : "重新上架"}</button>}
      {visibility === "published" && <Link href={`/work/${encodeURIComponent(slug)}`} aria-label={`查看 ${title}`} className="rounded-full border border-black/12 p-2"><ExternalLink size={15} /></Link>}
      <button disabled={busy} onClick={() => { setError(""); setConfirming(true); }} className="inline-flex items-center gap-1 rounded-full border border-red-700/20 px-3 py-2 text-xs text-red-700 disabled:opacity-50"><Trash2 size={13} />删除产品</button>
      {error && <span role="alert" className="w-full text-xs text-red-600">{error}</span>}
    </div>
    {confirming && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/55 px-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setConfirming(false); }}>
      <section role="alertdialog" aria-modal="true" aria-labelledby={`delete-title-${id}`} aria-describedby={`delete-description-${id}`} className="w-full max-w-md bg-[#f7f7f4] p-6 shadow-2xl">
        <p className="text-xs font-semibold tracking-wider text-red-700">永久删除</p>
        <h2 id={`delete-title-${id}`} className="mt-2 text-2xl font-semibold tracking-[-.045em]">删除“{title}”？</h2>
        <p id={`delete-description-${id}`} className="mt-4 text-sm leading-6 text-black/60">产品、全部发布记录、喜欢记录、照片和视频都会永久删除，无法恢复。</p>
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        <div className="mt-7 flex justify-end gap-2"><button ref={cancelRef} disabled={busy} onClick={() => setConfirming(false)} className="rounded-full border border-black/15 px-4 py-2.5 text-sm disabled:opacity-50">取消</button><button disabled={busy} onClick={() => void request("delete")} className="rounded-full bg-red-700 px-4 py-2.5 text-sm text-white disabled:opacity-50">{busy ? "正在删除…" : "永久删除"}</button></div>
      </section>
    </div>}
  </>;
}
