"use client";
import { Check, Copy, Heart, Share2, Star } from "lucide-react";
import { useEffect, useState } from "react";
import ReportButton from "./report-button";
type State = { likes: number; favorites: number; shares: number; views: number; liked: boolean; favorited: boolean; contactEmail?: string | null };
export default function ProductActions({ creationId, slug }: { creationId: number; slug: string }) {
  const [state, setState] = useState<State>({ likes: 0, favorites: 0, shares: 0, views: 0, liked: false, favorited: false }), [shareStatus, setShareStatus] = useState<"shared" | "copied" | null>(null), [error, setError] = useState("");
  const [contactOpen, setContactOpen] = useState(false), [emailCopied, setEmailCopied] = useState(false);
  useEffect(() => {
    Promise.all([
      fetch(`/api/creations/actions?creationId=${creationId}`).then((response) => response.ok ? response.json() as Promise<State> : Promise.reject()),
      fetch(`/api/creations?slug=${encodeURIComponent(slug)}`).then((response) => response.ok ? response.json() as Promise<{ contact_email?: string | null }> : Promise.reject()),
    ]).then(([actions, product]) => setState({ ...actions, contactEmail: actions.contactEmail || product.contact_email || null })).catch(() => undefined);
    fetch("/api/creations/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creationId, action: "view" }) }).then((response) => response.ok ? response.json() as Promise<{ views: number }> : Promise.reject()).then((data) => setState((current) => ({ ...current, views: data.views }))).catch(() => undefined);
  }, [creationId, slug]);
  async function like() { setError(""); const response = await fetch("/api/creations/react", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creationId }) }); if (response.status === 401) { location.assign(`/login?next=${encodeURIComponent(`/work/${slug}`)}`); return; } const data = await response.json() as { liked?: boolean; count?: number; error?: string }; if (!response.ok) { setError(data.error || "喜欢失败"); return; } setState((current) => ({ ...current, liked: Boolean(data.liked), likes: Number(data.count || 0) })); }
  async function favorite() { setError(""); const response = await fetch("/api/creations/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creationId, action: "favorite" }) }); if (response.status === 401) { location.assign(`/login?next=${encodeURIComponent(`/work/${slug}`)}`); return; } const data = await response.json() as { favorited?: boolean; favorites?: number; error?: string }; if (!response.ok) { setError(data.error || "收藏失败"); return; } setState((current) => ({ ...current, favorited: Boolean(data.favorited), favorites: Number(data.favorites || 0) })); }
  async function share() {
    setError("");
    let method: "native-share" | "copy-link" = "copy-link";
    if (navigator.share) {
      try {
        await navigator.share({ title: document.title, text: "在 First Look 发现了这个产品，来看看。", url: location.href });
        method = "native-share";
      } catch {
        // Sharing may be unavailable or canceled. Fall back to a copyable link.
      }
    }
    if (method === "copy-link") {
      try { await navigator.clipboard.writeText(location.href); }
      catch { setError("暂时无法分享，请手动复制当前网址"); return; }
    }
    const response = await fetch("/api/creations/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creationId, action: "share", source: method }) }).catch(() => null);
    if (response?.ok) setState((current) => ({ ...current, shares: current.shares + 1 }));
    setShareStatus(method === "native-share" ? "shared" : "copied");
    setTimeout(() => setShareStatus(null), 1800);
  }
  async function copyContactEmail() { if (!state.contactEmail) return; try { await navigator.clipboard.writeText(state.contactEmail); setEmailCopied(true); setTimeout(() => setEmailCopied(false), 1800); } catch { setError("复制失败，请手动选择邮箱地址复制"); } }

  return <div className="mt-8">
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={like} className={`inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium ${state.liked ? "bg-[#e15d36] text-white" : "bg-black text-white"}`}><Heart size={16} fill={state.liked ? "currentColor" : "none"} />{state.liked ? "已喜欢" : "喜欢"}<span className="text-xs opacity-65">{state.likes}</span></button>
      <button onClick={favorite} className={`inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium ${state.favorited ? "bg-[#e15d36] text-white" : "border border-black/15 bg-white text-black"}`}><Star size={16} fill={state.favorited ? "currentColor" : "none"} />{state.favorited ? "已收藏" : "收藏"}<span className="text-xs opacity-65">{state.favorites}</span></button>
      <button onClick={share} className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-medium">{shareStatus ? <Check size={16} /> : <Share2 size={16} />}{shareStatus === "shared" ? "已分享" : shareStatus === "copied" ? "链接已复制" : "分享"}</button>
      {state.contactEmail && <button type="button" onClick={() => setContactOpen((open) => !open)} aria-expanded={contactOpen} className="inline-flex items-center rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-medium">联系创作者</button>}
      <ReportButton creationId={creationId} />
    </div>
    {contactOpen && state.contactEmail && <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-black/10 bg-white p-4"><span className="select-all break-all text-sm font-medium">{state.contactEmail}</span><button type="button" onClick={() => void copyContactEmail()} className="inline-flex items-center gap-2 rounded-full border border-black/15 px-4 py-2 text-xs font-medium">{emailCopied ? <Check size={14} /> : <Copy size={14} />}{emailCopied ? "已复制" : "复制邮箱"}</button></div>}
    <div className="mt-4 flex items-center gap-4 text-xs text-black/45"><span>{state.views} 次浏览</span><span>{state.shares} 次分享</span></div>
    {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
  </div>;
}
