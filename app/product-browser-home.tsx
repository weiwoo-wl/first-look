"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, Play, Search, Sparkles } from "lucide-react";

type Media = { object_key: string; media_type: string };
type Product = { slug: string; title: string; description: string; type: string; status: string; creator_name: string; creator_handle?: string; created_at: string; likes: number; favorites: number; shares: number; views: number; media: Media[] };
const tabs = ["今日精选", "热门", "最新", "即将发布"];
const types = ["全部", "工具", "小程序", "网页", "视频", "数字人", "Skill", "图片", "音频", "实验", "其他"];
const colors = ["#c9dbd1", "#efd6c4", "#d8d3ea", "#cadced", "#303b52", "#eadfb7"];
const mediaSource = (media?: Media) => media ? `/api/media/file?key=${encodeURIComponent(media.object_key)}` : "";

function ProductCover({ product, active, color }: { product: Product; active: boolean; color: string }) {
  const media = product.media?.[0];
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) video.play().catch(() => undefined);
    else { video.pause(); video.currentTime = 0; }
  }, [active]);
  return <div className="product-cover" style={{ background: color }}>
    {media?.media_type === "video" ? <video ref={videoRef} src={mediaSource(media)} muted playsInline preload="auto" onLoadedData={(event) => { if (event.currentTarget.currentTime === 0 && event.currentTarget.duration > .1) event.currentTarget.currentTime = .1; }} /> : media ? <img src={mediaSource(media)} alt={`${product.title} 产品封面`} /> : <div className="product-cover-placeholder"><small>{product.type}</small><strong>{product.title}</strong><span>FIRST LOOK</span></div>}
    {media?.media_type === "video" && <span className="product-video-mark"><Play size={14} fill="currentColor" /></span>}
  </div>;
}

function EmptyProductSlot({ index }: { index: number }) {
  return <div className="product-stack-empty" aria-label={`空的产品展示位 ${index + 1}`}><div className={`product-waiting-art waiting-art-${index % 4}`} aria-hidden="true"><i /><b /><em /></div><span>空位</span><small>等待下一个产品</small></div>;
}

function ProductBrowser({ products }: { products: Product[] }) {
  const [active, setActive] = useState(-1);
  const trackRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function findCentered() {
    const track = trackRef.current;
    if (!track) return;
    const bounds = track.getBoundingClientRect(), center = bounds.left + bounds.width / 2;
    let nearest = 0, distance = Number.POSITIVE_INFINITY;
    itemRefs.current.slice(0, products.length).forEach((item, index) => { if (!item) return; const box = item.getBoundingClientRect(), next = Math.abs(box.left + box.width / 2 - center); if (next < distance) { nearest = index; distance = next; } });
    setActive(nearest);
  }
  function handleScroll() { if (settleTimer.current) clearTimeout(settleTimer.current); settleTimer.current = setTimeout(findCentered, 70); }
  function select(index: number) { if (!products[index]) return; setActive(index); itemRefs.current[index]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }); }
  if (!products.length) return <div className="product-browser-shell grid min-h-72 place-items-center px-6 text-center"><div><h2 className="text-xl font-semibold">这里还没有产品</h2><p className="mt-2 text-sm text-black/45">换一个分类或搜索词看看，也可以发布第一个。</p><a href="/create" className="mt-5 inline-flex rounded-full bg-black px-5 py-2.5 text-sm text-white">发布作品</a></div></div>;
  const slotCount = products.length;
  return <div className="product-browser-shell" onKeyDown={(event) => { if (event.key === "ArrowLeft") select(Math.max(active - 1, 0)); if (event.key === "ArrowRight") select(Math.min(active + 1, products.length - 1)); }}>
    <div className="product-browser-top"><div><h2>发现产品</h2><p>左右滑动，看看大家正在创造什么。</p></div><div className="product-browser-controls"><button onClick={() => select(Math.max(active - 1, 0))} disabled={active <= 0 || !products.length} aria-label="上一个产品"><ArrowLeft /></button><span>{products.length ? `${active >= 0 ? active + 1 : "未选择"} / ${products.length}` : "等待产品"}</span><button onClick={() => select(Math.min(active + 1, products.length - 1))} disabled={!products.length || active === products.length - 1} aria-label="下一个产品"><ArrowRight /></button></div></div>
    <div ref={trackRef} className="product-stack" onScroll={handleScroll} tabIndex={0} aria-label="产品展示">
      <div className="product-stack-spacer" aria-hidden="true" />
      {Array.from({ length: slotCount }, (_, index) => { const product = products[index]; return product ? <div key={product.slug} className={`product-stack-item ${index === active ? "is-active" : ""}`} style={{ zIndex: index === active ? slotCount + 2 : index + 1 }} onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive((current) => current === index ? -1 : current)}><a ref={(node) => { itemRefs.current[index] = node; }} href={`/work/${encodeURIComponent(product.slug)}`} className="product-stack-link" onClick={(event) => { if (index !== active) { event.preventDefault(); select(index); } }} aria-current={index === active ? "true" : undefined}><ProductCover product={product} active={index === active} color={colors[index % colors.length]} /></a>{index === active && <div className="product-card-detail" aria-live="polite"><span>{product.type}</span><h3>{product.title}</h3><p>{product.description}</p>{product.creator_handle?<a href={`/creator/${encodeURIComponent(product.creator_handle)}`}><small>{product.creator_name}</small></a>:<small>{product.creator_name}</small>}</div>}</div> : <div key={`empty-${index}`} className="product-stack-item product-stack-empty-item" style={{ zIndex: index + 1 }}><EmptyProductSlot index={index} /></div>; })}
      <div className="product-stack-spacer" aria-hidden="true" />
    </div>
  </div>;
}

export default function ProductBrowserHome() {
  const [products, setProducts] = useState<Product[]>([]), [query, setQuery] = useState(""), [activeTab, setActiveTab] = useState("今日精选"), [activeType, setActiveType] = useState("全部");
  const [user, setUser] = useState<{ displayName: string } | null>(null), [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState(false);
  const [logoReveal, setLogoReveal] = useState(0);
  const [contactOpen, setContactOpen] = useState(false), [contactCopied, setContactCopied] = useState(false);
  useEffect(() => {
    fetch("/api/creations", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<Product[]> : Promise.reject()).then((remote) => { setProducts(remote); setLoadError(false); }).catch(() => setLoadError(true)).finally(() => setLoading(false));
    fetch("/api/auth/session").then((response) => response.ok ? response.json() as Promise<{ user: { displayName: string } | null; isAdmin?: boolean }> : { user: null, isAdmin: false }).then((session) => { setUser(session.user || null); setIsAdmin(Boolean(session.isAdmin)); }).catch(() => undefined);
  }, []);
  const visible = useMemo(() => {
    const filtered = products.filter((product) => (activeType === "全部" || product.type.includes(activeType)) && (!query || `${product.title} ${product.description} ${product.creator_name}`.toLowerCase().includes(query.toLowerCase())) && (activeTab !== "即将发布" || ["早期测试", "概念阶段"].includes(product.status)));
    return [...filtered].sort((a, b) => {
      if (activeTab === "热门") return (b.likes * 4 + b.favorites * 3 + b.shares * 2 + b.views) - (a.likes * 4 + a.favorites * 3 + a.shares * 2 + a.views);
      if (activeTab === "最新" || activeTab === "即将发布") return Date.parse(b.created_at) - Date.parse(a.created_at);
      const aReady = a.status === "正在使用" ? 1 : 0, bReady = b.status === "正在使用" ? 1 : 0;
      return bReady - aReady || (b.likes + b.favorites) - (a.likes + a.favorites) || Date.parse(b.created_at) - Date.parse(a.created_at);
    });
  }, [products, activeTab, activeType, query]);
  return <main className="min-h-dvh bg-[#f7f7f4] text-[#171717]">
    <header className="sticky top-0 z-30 border-b border-black/10 bg-[#f7f7f4]/95 backdrop-blur"><div className="mx-auto flex h-[68px] max-w-7xl items-center gap-7 px-5 lg:px-8"><a href="#top" className="flex shrink-0 items-center gap-2.5" aria-label="First Look 首页"><img src="/koi-logo.png" alt="" className="h-8 w-8 object-contain" /><span className="text-[15px] font-bold tracking-[-0.05em]">FIRST LOOK</span></a><div className="hidden h-7 w-px bg-black/10 md:block" /><nav className="hidden items-center gap-5 text-sm text-black/55 md:flex" aria-label="主导航">{tabs.map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`transition hover:text-black ${activeTab === tab ? "font-semibold text-black" : ""}`}>{tab}</button>)}</nav><div className="ml-auto flex items-center gap-3"><label className="hidden items-center gap-2 rounded-full border border-black/12 bg-white px-3 py-2 text-sm text-black/45 sm:flex"><Search size={15} /><span className="sr-only">搜索作品</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索作品" className="w-28 bg-transparent outline-none placeholder:text-black/40" /></label>{isAdmin&&<a href="/admin" className="hidden rounded-full border border-black/15 px-4 py-2 text-sm font-medium sm:block">管理后台</a>}{user ? <a href="/account" className="max-w-36 truncate rounded-full border border-black/15 px-4 py-2 text-sm font-medium" title="打开账户设置">{user.displayName}</a> : <a href="/login" className="rounded-full border border-black/15 px-4 py-2 text-sm font-medium">注册／登录</a>}<a href="/create" className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#111] px-4 py-2 text-sm font-medium text-white"><Sparkles size={14} />发布作品</a></div></div></header>
    <section id="top" className="mx-auto max-w-[1600px] px-5 pb-10 pt-12 lg:px-8 lg:pt-16"><div className="product-hero-row"><div className="product-hero-copy"><h1 className="text-4xl font-semibold leading-[1.08] tracking-[-0.065em] sm:text-5xl lg:text-[4rem]">每一个用 AI 创造的产品，<br /><span className="text-black/35">尤其是非专业创造者的产品，都有被发现的机会。</span></h1></div><div className="product-hero-logo-zone" aria-label="First Look 彩色标志" onMouseMove={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); setLogoReveal((previous) => Math.max(previous, Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100)))); }}><div className="product-hero-logo" style={{ clipPath: `inset(0 ${100 - logoReveal}% 0 0)` }}><span data-wordmark="FIRST LOOK">FIRST LOOK</span></div></div></div></section>
    <section className="mx-auto max-w-7xl px-5 pb-20 lg:px-8"><div className="mb-8 flex gap-2 overflow-x-auto pb-1 scrollbar-none" aria-label="作品分类">{types.map((type) => <button key={type} onClick={() => setActiveType(type)} className={`shrink-0 rounded-full border px-4 py-2 text-sm transition ${activeType === type ? "border-[#171717] bg-[#171717] text-white" : "border-black/12 bg-white text-black/55 hover:border-black/30 hover:text-black"}`}>{type}</button>)}</div>{loading ? <div className="product-browser-shell min-h-72 animate-pulse bg-black/[.025]" aria-label="正在载入产品" /> : loadError ? <div className="product-browser-shell grid min-h-72 place-items-center text-center"><div><p className="text-sm text-black/55">产品暂时没有加载出来</p><button onClick={() => window.location.reload()} className="mt-4 rounded-full border border-black/15 px-5 py-2 text-sm">重新载入</button></div></div> : <ProductBrowser key={visible.map((product) => product.slug).join("|")} products={visible} />}</section>
    <footer className="border-t border-black/10 px-5 py-8 text-xs text-black/40"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4"><span>© 2026 First Look</span><div className="flex flex-wrap items-center gap-5"><span>所有正在发生的创造</span><button type="button" aria-expanded={contactOpen} onClick={() => { setContactOpen((open) => !open); setContactCopied(false); }} className="text-black/60 transition hover:text-black">联系我们</button>{contactOpen&&<span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-black/70"><a href="mailto:server@firstlooklab.cn" className="select-all">server@firstlooklab.cn</a><button type="button" aria-label="复制联系邮箱" title="复制邮箱" onClick={() => { void navigator.clipboard.writeText("server@firstlooklab.cn").then(() => { setContactCopied(true); window.setTimeout(() => setContactCopied(false), 1800); }); }} className="inline-flex items-center gap-1 text-black/45 hover:text-black">{contactCopied?<Check size={13}/>:<Copy size={13}/>}<span>{contactCopied?"已复制":"复制"}</span></button></span>}</div></div></footer>
  </main>;
}
