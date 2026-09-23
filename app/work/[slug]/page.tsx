// @ts-nocheck
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Heart, Share2 } from "lucide-react";
import ProductDetail from "./product-detail";

type Work = { description?: string; maker?: string; type?: string; status?: string; story?: string; preview?: string; likes?: number };

export default function WorkPage({ params }: { params: Promise<{ slug: string }> }) {
  return <ProductDetail params={params} />;
  const [title, setTitle] = useState("");
  const [work, setWork] = useState<Work>({});
  const [liked, setLiked] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    params.then(({ slug }) => {
      const name = decodeURIComponent(slug);
      setTitle(name);
      const saved = JSON.parse(window.localStorage.getItem("first-look-creations") || "[]");
      const found = saved.find((item: { title: string }) => item.title === name);
      setWork(found || {});
      setLiked(JSON.parse(window.localStorage.getItem("first-look-liked") || "[]").includes(name));
    });
  }, [params]);

  function toggleLike() {
    const current = JSON.parse(window.localStorage.getItem("first-look-liked") || "[]");
    const next = current.includes(title) ? current.filter((item: string) => item !== title) : [...current, title];
    window.localStorage.setItem("first-look-liked", JSON.stringify(next));
    setLiked(!liked);
  }

  async function share() {
    await navigator.clipboard?.writeText(window.location.href);
    setShared(true);
    window.setTimeout(() => setShared(false), 2200);
  }

  return <main className="min-h-dvh bg-[#f7f7f4] text-[#171717]"><header className="border-b border-black/10"><div className="mx-auto flex h-[68px] max-w-5xl items-center px-5 lg:px-0"><Link href="/" className="inline-flex items-center gap-2 text-sm text-black/55 hover:text-black"><ArrowLeft size={16} />返回发现</Link></div></header><section className="mx-auto max-w-5xl px-5 py-10 lg:px-0 lg:py-16"><div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]"><div className="relative flex min-h-[360px] items-end overflow-hidden rounded-2xl bg-gradient-to-br from-[#f2d9c7] to-[#d6a984] p-8">{work.preview && <img src={work.preview} alt="作品预览" className="absolute inset-0 h-full w-full object-cover opacity-80" />}<span className="relative text-5xl font-semibold tracking-[-0.08em]">{title || "你的作品"}</span></div><div><span className="rounded bg-[#f4d4c9] px-2 py-1 text-xs text-[#a84123]">{work.type || "作品展示"}</span><h1 className="mt-5 text-4xl font-semibold tracking-[-0.07em]">{title || "你的作品"}</h1><p className="mt-5 text-lg leading-8 text-black/60">{work.description || "这是一个作品展示页面。创作者可以在这里介绍自己的创造，以及它是如何被使用的。"}</p><div className="mt-8 flex gap-3"><button onClick={toggleLike} className={`inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium ${liked ? "bg-[#e15d36] text-white" : "bg-black text-white"}`}><Heart size={16} fill={liked ? "currentColor" : "none"} />{liked ? "已喜欢" : "喜欢"}</button><button onClick={share} className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-medium">{shared ? <Check size={16} /> : <Share2 size={16} />}{shared ? "链接已复制" : "分享"}</button></div><div className="mt-10 border-t border-black/10 pt-5 text-sm text-black/45"><p>由 <span className="font-medium text-black/70">{work.maker || "我"}</span> 发布</p><p className="mt-2">{work.status || "刚刚发布"} · First Look</p></div></div></div><div className="mt-16 max-w-2xl border-t border-black/10 pt-8"><h2 className="text-xl font-semibold tracking-[-0.04em]">为什么做？</h2><p className="mt-4 leading-7 text-black/60">{work.story || "创作者可以在这里补充创作背后的想法，让第一次看到它的人能够快速理解并开始使用。"}</p></div></section></main>;
}
