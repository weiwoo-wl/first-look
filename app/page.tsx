// @ts-nocheck
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Heart, MessageCircle, Play, Search, Share2, Sparkles } from "lucide-react";
import ProductBrowserEntry from "./product-browser-entry";

type Creation = { title: string; description: string; maker: string; type: string; color: string; likes: number; comments: number; badge?: string; preview?: string };

const creations: Creation[] = [
  { title: "Mori", description: "为每一次散步生成一份属于你的城市观察。", maker: "一个独立开发者", type: "AI 生活", color: "from-[#d8e7df] to-[#b6cdbf]", likes: 184, comments: 26, badge: "今日精选" },
  { title: "Paper Cut", description: "把复杂的研究资料，整理成一页清晰的决策简报。", maker: "Lena Chen", type: "AI 效率", color: "from-[#f2d9c7] to-[#d6a984]", likes: 126, comments: 18 },
  { title: "Aster", description: "一个会记住你语气的数字人，帮你回答重复的问题。", maker: "Mina Studio", type: "数字人", color: "from-[#d9d4ec] to-[#a9a0ca]", likes: 98, comments: 14 },
  { title: "Relay", description: "把会议里的想法，变成下一步可以执行的任务。", maker: "Northstar Studio", type: "AI 办公", color: "from-[#c9d9ed] to-[#8eaed0]", likes: 76, comments: 9 },
  { title: "夜航", description: "一部用 AI 完成的三分钟科幻短片，关于离开地球之前。", maker: "陈默", type: "视频", color: "from-[#303b52] to-[#121827]", likes: 64, comments: 21 },
  { title: "Tiny Rituals", description: "给忙碌的人，一组可以真的坚持下来的微小练习。", maker: "Yuki", type: "实验", color: "from-[#eadfb7] to-[#d4b965]", likes: 52, comments: 7 },
];

const tabs = ["今日精选", "热门", "最新", "即将发布"];
const types = ["全部", "工具", "小程序", "网页", "视频", "数字人", "Skill", "图片", "音频", "实验", "其他"];

export default function Home() {
  return <ProductBrowserEntry />;
  const [items, setItems] = useState<Creation[]>(creations);
  const [activeTab, setActiveTab] = useState("今日精选");
  const [activeType, setActiveType] = useState("全部");
  const [query, setQuery] = useState("");
  const [liked, setLiked] = useState<string[]>([]);
  const [user, setUser] = useState<{ display_name: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/session").then((response) => response.ok ? response.json() as Promise<{ user: { displayName: string } | null }> : { user: null }).then((data) => setUser(data.user ? { display_name: data.user.displayName } : null)).catch(() => undefined);
  }, []);

  useEffect(() => {
    function routePublish(event: MouseEvent) {
      const target = event.target as HTMLElement;
      const link = target.closest('a[href="/create"]');
      if (!link) return;
      event.preventDefault();
      window.location.assign("/create");
    }
    document.addEventListener("click", routePublish, true);
    return () => document.removeEventListener("click", routePublish, true);
  }, []);

  const visibleCreations = useMemo(() => items.filter((item) => {
    const matchesType = activeType === "全部" || item.type.includes(activeType);
    const matchesQuery = !query || `${item.title} ${item.description} ${item.maker}`.toLowerCase().includes(query.toLowerCase());
    return matchesType && matchesQuery;
  }), [items, activeType, query]);

  useEffect(() => {
    fetch("/api/creations")
      .then((response) => response.ok ? response.json() as Promise<Array<{ title: string; description: string; type: string; creatorName: string; likes?: number; comments?: number }>> : [])
      .then((remote) => {
        if (!remote.length) return;
        setItems((current) => {
          const remoteItems = remote.map((item) => ({
            title: item.title,
            description: item.description,
            maker: item.creatorName,
            type: item.type,
            color: "from-[#f2d9c7] to-[#d6a984]",
            likes: item.likes || 0,
            comments: item.comments || 0,
            badge: "刚刚发布",
          }));
          const titles = new Set(remoteItems.map((item) => item.title));
          return [...remoteItems, ...current.filter((item) => !titles.has(item.title))];
        });
      })
      .catch(() => undefined);
  }, []);

  function toggleLike(title: string) {
    setLiked((current) => current.includes(title) ? current.filter((item) => item !== title) : [...current, title]);
  }

  return (
    <main className="min-h-dvh bg-[#f7f7f4] text-[#171717]">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-[#f7f7f4]/95 backdrop-blur">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center gap-7 px-5 lg:px-8">
          <a href="#top" className="flex shrink-0 items-center gap-2.5" aria-label="First Look 首页">
            <img src="/koi-logo.png" alt="" className="h-8 w-8 object-contain" />
            <span className="text-[15px] font-bold tracking-[-0.05em]">FIRST LOOK</span>
          </a>
          <div className="hidden h-7 w-px bg-black/10 md:block" />
          <nav className="hidden items-center gap-5 text-sm text-black/55 md:flex" aria-label="主导航">
            {tabs.map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`transition hover:text-black ${activeTab === tab ? "font-semibold text-black" : ""}`}>{tab}</button>)}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <label className="hidden items-center gap-2 rounded-full border border-black/12 bg-white px-3 py-2 text-sm text-black/45 sm:flex">
              <Search size={15} aria-hidden="true" /><span className="sr-only">搜索作品</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索作品" className="w-28 bg-transparent outline-none placeholder:text-black/35" />
            </label>
            {user ? <button onClick={async () => { await fetch("/api/auth/session", { method: "DELETE" }); window.location.reload(); }} className="rounded-full border border-black/15 px-4 py-2 text-sm font-medium" title="点击退出登录">{user.display_name} · 退出</button> : <a href="/login" className="rounded-full border border-black/15 px-4 py-2 text-sm font-medium transition hover:bg-white">注册／登录</a>}
            <Link href="/create" className="flex items-center gap-1.5 rounded-full bg-[#111] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#333]"><Sparkles size={14} aria-hidden="true" />发布作品</Link>
          </div>
        </div>
      </header>

      <section id="top" className="mx-auto max-w-7xl px-5 pb-10 pt-12 lg:px-8 lg:pt-16">
        <div className="max-w-2xl">
          <h1 className="max-w-4xl text-4xl font-semibold leading-[1.08] tracking-[-0.065em] sm:text-5xl lg:text-[4rem]">让每一个用 AI 创造的产品，<br /><span className="text-black/35">尤其是非专业创造者的产品，都有被发现的机会。</span></h1>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16 lg:px-8">
        <div className="mb-8 flex gap-2 overflow-x-auto pb-1 scrollbar-none" aria-label="作品分类">
          {types.map((type) => <button key={type} onClick={() => setActiveType(type)} className={`shrink-0 rounded-full border px-4 py-2 text-sm transition ${activeType === type ? "border-[#171717] bg-[#171717] text-white" : "border-black/12 bg-white text-black/55 hover:border-black/30 hover:text-black"}`}>{type}</button>)}
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-black/10 pb-3"><h2 className="text-lg font-semibold tracking-[-0.04em]">{activeTab}</h2><span className="text-xs text-black/40">{visibleCreations.length} 个作品</span></div>
            {visibleCreations.map((item) => (
              <article key={item.title} className="group flex gap-4 border-b border-black/10 py-4 sm:gap-5">
                <div className={`relative flex h-28 w-28 shrink-0 items-end overflow-hidden rounded-xl bg-gradient-to-br ${item.color} p-3 sm:h-36 sm:w-36`}>{"preview" in item && item.preview && <img src={item.preview} alt={`${item.title} 预览`} className="absolute inset-0 h-full w-full object-cover" />}<span className="relative text-xl font-semibold tracking-[-0.07em] text-black/75">{item.title}</span>{item.type === "视频" && <span className="absolute right-3 top-3 rounded-full bg-white/80 p-2"><Play size={13} fill="currentColor" aria-label="视频作品" /></span>}</div>
                <div className="min-w-0 flex-1 py-0.5"><div className="flex items-start justify-between gap-3"><div><div className="mb-1 flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold tracking-[-0.045em]">{item.title}</h3>{item.badge && <span className="rounded bg-[#f4d4c9] px-2 py-1 text-[10px] font-semibold text-[#a84123]">{item.badge}</span>}</div><p className="max-w-xl text-sm leading-6 text-black/58">{item.description}</p></div><button onClick={() => toggleLike(item.title)} aria-label={`${liked.includes(item.title) ? "取消喜欢" : "喜欢"} ${item.title}`} className={`shrink-0 rounded-full p-2 transition ${liked.includes(item.title) ? "bg-[#f4d4c9] text-[#c84d2c]" : "text-black/35 hover:bg-white hover:text-black"}`}><Heart size={18} fill={liked.includes(item.title) ? "currentColor" : "none"} /></button></div><div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-black/40"><span className="font-medium text-black/60">{item.maker}</span><span>{item.type}</span><span className="inline-flex items-center gap-1"><Heart size={13} />{item.likes + (liked.includes(item.title) ? 1 : 0)}</span><span className="inline-flex items-center gap-1"><MessageCircle size={13} />{item.comments}</span><button className="ml-auto inline-flex items-center gap-1 transition hover:text-black"><Share2 size={13} />分享</button></div></div>
              </article>
            ))}
            {!visibleCreations.length && <div className="rounded-xl border border-dashed border-black/15 bg-white p-10 text-center text-sm text-black/50">没有找到匹配的作品，换个关键词试试。</div>}
          </div>
          <aside className="hidden space-y-4 lg:block">
            <div className="rounded-xl border border-black/10 bg-white p-5"><div className="mb-5 flex items-center justify-between"><h2 className="font-semibold tracking-[-0.04em]">今日热榜</h2><ArrowUpRight size={17} className="text-black/35" /></div><ol className="space-y-4">{creations.slice(0, 5).map((item, index) => <li key={item.title} className="flex items-start gap-3"><span className="w-4 text-sm font-semibold text-black/30">0{index + 1}</span><div className="min-w-0"><p className="truncate text-sm font-medium">{item.title}</p><p className="mt-1 text-xs text-black/40">{item.likes} 人喜欢</p></div></li>)}</ol></div>
            <div className="rounded-2xl bg-[#171717] p-6 text-white shadow-xl shadow-black/10"><p className="mb-8 text-xs text-white/45">FIRST LOOK FOR CREATORS</p><h2 className="text-2xl font-semibold leading-tight tracking-[-0.055em]">做了一个东西？<br />让它被看见。</h2><Link href="/create" className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black">发布作品 <ArrowUpRight size={15} /></Link></div>
          </aside>
        </div>
      </section>
      <footer className="border-t border-black/10 px-5 py-8 text-xs text-black/40"><div className="mx-auto flex max-w-7xl justify-between"><span>© 2026 First Look</span><span>所有正在发生的创造</span></div></footer>
    </main>
  );
}
