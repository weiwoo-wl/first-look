"use client";

import { useState } from "react";
import { extractSharedUrl } from "../lib/technical";

export default function EntryCheck({ type, productUrl, verified, onVerified }: {
  type: string;
  productUrl: string;
  verified: boolean;
  onVerified: (value: boolean) => void;
}) {
  const [message, setMessage] = useState("");

  async function testEntry() {
    setMessage("");
    if (type === "小程序") {
      const value = productUrl.trim(), link = extractSharedUrl(value);
      if (link) { window.open(link, "_blank", "noopener,noreferrer"); setMessage("已尝试打开分享内容中的网址，请确认能否正常使用。"); }
      else if (value) {
        try { await navigator.clipboard.writeText(value); setMessage("分享内容已复制，请到微信中打开并确认。"); }
        catch { setMessage("复制失败，请手动复制名称或口令，再到微信中测试。"); }
      } else setMessage("请先粘贴微信中的小程序分享内容。");
      return;
    }
    if (!productUrl.trim()) { setMessage("请先填写产品入口。"); return; }
    window.open(productUrl.trim(), "_blank", "noopener,noreferrer");
    setMessage("已尝试打开入口，请确认它能正常使用。");
  }

  return <section className="rounded-lg border border-black/10 bg-white p-4" aria-label="入口测试">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-medium">入口状态：<span className={verified ? "text-emerald-700" : "text-amber-700"}>{verified ? "已验证" : "尚未验证（仅你可见）"}</span></p><button type="button" onClick={() => void testEntry()} className="min-h-10 rounded-full border border-black/15 px-4 py-2 text-xs">测试入口</button></div>
    <div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" onClick={() => { onVerified(true); setMessage("已记录你的确认。"); }} className={`min-h-10 rounded-full px-4 py-2 text-xs ${verified ? "bg-emerald-700 text-white" : "bg-black text-white"}`}>{verified ? "已确认入口可用" : "我确认可以正常打开"}</button>{verified && <button type="button" onClick={() => { onVerified(false); setMessage("已改为尚未验证。"); }} className="min-h-10 rounded-full border border-black/15 px-4 py-2 text-xs">取消确认</button>}</div>
    {message && <p role="status" className="mt-3 text-xs leading-5 text-black/55">{message}</p>}
  </section>;
}
