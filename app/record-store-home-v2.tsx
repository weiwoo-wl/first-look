"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Play, Search, X } from "lucide-react";

type Media = { object_key: string; media_type: string };
type Work = {
  slug: string;
  title: string;
  description: string;
  type: string;
  creator_name: string;
  media: Media[];
};

const demo: Work[] = [
  { slug: "mori", title: "Mori", description: "为每一次散步生成一份属于你的城市观察。", type: "AI 生活", creator_name: "一个独立开发者", media: [] },
  { slug: "paper-cut", title: "Paper Cut", description: "把复杂的研究资料，整理成一页清晰的决策简报。", type: "AI 效率", creator_name: "Lena Chen", media: [] },
];

const coverColors = ["#b7c7b7", "#dfbea1", "#b7b0c7", "#d4cc8f", "#93aebc", "#cf9f9b"];

function mediaUrl(media?: Media) {
  return media ? `/api/media/file?key=${encodeURIComponent(media.object_key)}` : "";
}

function Sleeve({ work, index, featured = false }: { work: Work; index: number; featured?: boolean }) {
  const cover = work.media?.[0];
  const src = mediaUrl(cover);
  return (
    <div className={`record-sleeve ${featured ? "record-sleeve-featured" : ""}`} style={{ "--sleeve-color": coverColors[index % coverColors.length] } as React.CSSProperties}>
      <div className="record-disc" aria-hidden="true"><i /></div>
      <div className="record-cover">
        {cover?.media_type === "video" ? (
          <video
            src={src}
            muted
            playsInline
            preload="metadata"
            onMouseEnter={(event) => event.currentTarget.play().catch(() => undefined)}
            onMouseLeave={(event) => { event.currentTarget.pause(); event.currentTarget.currentTime = 0; }}
            className="record-cover-media"
          />
        ) : src ? (
          <img src={src} alt={work.title} className="record-cover-media" />
        ) : (
          <div className="record-cover-type"><span>{work.type}</span><strong>{work.title}</strong><small>FIRST LOOK RECORDS</small></div>
        )}
        {cover?.media_type === "video" && <span className="record-play" aria-label="视频作品"><Play size={15} fill="currentColor" /></span>}
      </div>
    </div>
  );
}

function WorkCard({ work, index }: { work: Work; index: number }) {
  return (
    <Link href={`/work/${encodeURIComponent(work.slug)}`} className="record-item">
      <Sleeve work={work} index={index} />
      <div className="record-meta">
        <div><h2>{work.title}</h2><p>{work.creator_name}</p></div>
        <span>{work.type}</span>
      </div>
    </Link>
  );
}

export default function RecordStoreHomeV2() {
  const [works, setWorks] = useState<Work[]>(demo);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ displayName: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/creations").then((response) => response.ok ? response.json() as Promise<Work[]> : [] as Work[]),
      fetch("/api/auth/session").then((response) => response.ok ? response.json() as Promise<{ user: { displayName: string } | null }> : { user: null }),
    ]).then(([items, session]) => {
      if (items.length) setWorks([...items, ...demo.filter((sample) => !items.some((work) => work.title === sample.title))]);
      setUser(session.user || null);
    }).finally(() => setLoading(false));
  }, []);

  const shown = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return works;
    return works.filter((work) => `${work.title} ${work.description} ${work.creator_name} ${work.type}`.toLowerCase().includes(normalized));
  }, [works, query]);

  const featured = shown[0];
  const shelf = shown.slice(1);

  return (
    <main className="record-store">
      <header className="store-nav">
        <div className="store-nav-inner">
          <Link href="/" className="store-wordmark"><b>FIRST LOOK</b><span>RECORDS</span></Link>
          <nav aria-label="主导航"><a href="#new-arrivals">新到作品</a><a href="#catalog">全部唱片</a></nav>
          <div className="store-actions">
            <button className="store-search-trigger" onClick={() => setSearchOpen((value) => !value)} aria-label="搜索作品"><Search size={18} /></button>
            {user ? <button className="store-account" onClick={async () => { await fetch("/api/auth/session", { method: "DELETE" }); location.reload(); }}>{user.displayName}<span>退出</span></button> : <Link href="/login" className="store-login">登录</Link>}
            <Link href="/create" className="store-publish">发布作品</Link>
          </div>
        </div>
        {searchOpen && <div className="store-search"><Search size={20} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入作品名、作者或类型" aria-label="搜索作品" /><button onClick={() => { setQuery(""); setSearchOpen(false); }} aria-label="关闭搜索"><X size={20} /></button></div>}
      </header>

      {featured ? (
        <section className="store-hero" id="new-arrivals">
          <div className="hero-copy">
            <p className="hero-label">独立 AI 作品商店</p>
            <h1>像挑一张唱片，<br />发现一个新作品。</h1>
            <p className="hero-description">这里收录独立创作者刚刚完成的产品。先看封面，再听它讲自己的故事。</p>
            <Link href={`/work/${encodeURIComponent(featured.slug)}`} className="hero-link">打开本周主打 <ArrowRight size={18} /></Link>
          </div>
          <Link href={`/work/${encodeURIComponent(featured.slug)}`} className="hero-record" aria-label={`查看 ${featured.title}`}>
            <Sleeve work={featured} index={0} featured />
            <div className="hero-record-info"><span>本周主打</span><strong>{featured.title}</strong><small>{featured.creator_name}</small></div>
          </Link>
        </section>
      ) : null}

      <section className="record-bin" id="catalog">
        <div className="bin-heading"><h2>{query ? "搜索结果" : "新到唱片"}</h2><p>{shown.length} 件作品</p></div>
        {loading ? (
          <div className="record-loading" aria-label="正在整理唱片"><i /><i /><i /><i /></div>
        ) : shelf.length ? (
          <div className="record-shelf">{shelf.map((work, index) => <WorkCard key={work.slug} work={work} index={index + 1} />)}</div>
        ) : shown.length === 1 && !query ? (
          <div className="record-empty"><p>唱片架正在等下一件作品。</p><Link href="/create">把你的作品放进来</Link></div>
        ) : !shown.length ? (
          <div className="record-empty"><p>没有找到这张唱片。</p><button onClick={() => setQuery("")}>查看全部作品</button></div>
        ) : null}
        <div className="bin-front" aria-hidden="true"><span>FIRST LOOK / INDEPENDENT RELEASES</span></div>
      </section>

      <footer className="store-footer"><b>FIRST LOOK RECORDS</b><p>每一件新作品，都值得被认真翻到。</p><Link href="/create">发布你的作品 <ArrowRight size={16} /></Link></footer>
    </main>
  );
}
