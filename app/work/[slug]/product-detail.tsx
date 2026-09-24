// @ts-nocheck
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useParams } from "next/navigation";
import ProductActions from "./product-actions";
type Media = { object_key: string; media_type: string };
type Work = { technical?: unknown; id: number; slug: string; title: string; description: string; type: string; status: string; story: string; creator_name: string; media: Media[] };
export default function ProductDetail() {
  const params = useParams<{ slug: string }>(), slug = params.slug;
  const [work, setWork] = useState<Work | null>(null), [index, setIndex] = useState(0), [error, setError] = useState("");
  useEffect(() => { if (!slug) return; fetch(`/api/creations?slug=${encodeURIComponent(slug)}`).then((response) => response.ok ? response.json() : Promise.reject()).then(setWork).catch(() => setError("作品不存在")); }, [slug]);
  if (error) return <main className="p-12">{error}</main>;
  if (!work) return <main className="p-12">正在打开作品…</main>;
  const media = work.media?.[index], src = media ? `/api/media/file?key=${encodeURIComponent(media.object_key)}` : "";
  return <main className="min-h-dvh bg-[#f7f7f4] text-[#171717]"><header className="border-b border-black/10"><div className="mx-auto flex h-16 max-w-7xl items-center px-5"><Link href="/" className="inline-flex items-center gap-2 text-sm text-black/50"><ArrowLeft size={16} />返回作品</Link></div></header><section className="mx-auto grid max-w-7xl gap-10 px-5 py-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)] lg:py-16"><div><div className="relative aspect-square overflow-hidden bg-[#d9d1c3] shadow-[0_20px_55px_rgba(0,0,0,.16)]">{media?.media_type === "video" ? <video src={src} controls playsInline preload="auto" onLoadedData={(event) => { if (event.currentTarget.currentTime === 0 && event.currentTarget.duration > .1) event.currentTarget.currentTime = .1; }} className="h-full w-full bg-black object-contain" /> : src ? <img src={src} alt={work.title} className="h-full w-full object-contain" /> : <span className="absolute bottom-10 left-10 text-6xl font-semibold tracking-[-.08em]">{work.title}</span>}{work.media?.length > 1 && <><button onClick={() => setIndex((index - 1 + work.media.length) % work.media.length)} aria-label="上一个媒体" className="absolute left-3 top-1/2 rounded-full bg-white/90 p-3"><ChevronLeft /></button><button onClick={() => setIndex((index + 1) % work.media.length)} aria-label="下一个媒体" className="absolute right-3 top-1/2 rounded-full bg-white/90 p-3"><ChevronRight /></button></>}</div>{work.media?.length > 1 && <div className="mt-4 flex gap-2 overflow-x-auto">{work.media.map((item, mediaIndex) => <button key={item.object_key} onClick={() => setIndex(mediaIndex)} aria-label={`查看第 ${mediaIndex + 1} 个媒体`} className={`h-2 w-10 rounded-full ${mediaIndex === index ? "bg-black" : "bg-black/15"}`} />)}</div>}</div><aside className="lg:sticky lg:top-10 lg:self-start"><p className="text-xs uppercase tracking-[.2em] text-black/40">{work.type} · {work.status}</p><h1 className="mt-5 text-5xl font-semibold tracking-[-.07em]">{work.title}</h1><p className="mt-6 text-lg leading-8 text-black/60">{work.description}</p><p className="mt-8 border-t border-black/10 pt-6 text-sm">由 <b>{work.creator_name}</b> 发布</p><ProductActions creationId={work.id} slug={work.slug} />{work.story && <div className="mt-10"><h2 className="font-semibold">为什么做？</h2><p className="mt-3 leading-7 text-black/55">{work.story}</p></div>}</aside></section></main>;
}
