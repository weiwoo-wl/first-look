"use client";

import { ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ProductControls from "./controls";
import LifeLine, { type ProductEvent, type ProductVersion } from "./life-line";

type Product = { id:number; slug:string; title:string; description:string; type:string; status:string; visibility:string; contact_email_visible:number; updated_at:string; latest_version:number|null; likes_total:number };
type History = { versions: ProductVersion[]; events: ProductEvent[] };

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [histories, setHistories] = useState<Record<number, History>>({});
  const [historyErrors, setHistoryErrors] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadHistory = useCallback(async (productId: number) => {
    setHistoryErrors((current) => ({ ...current, [productId]: false }));
    try {
      const response = await fetch(`/api/creations/history?creationId=${productId}`);
      if (!response.ok) throw new Error();
      const data = await response.json() as History;
      setHistories((current) => ({ ...current, [productId]: data }));
    } catch {
      setHistoryErrors((current) => ({ ...current, [productId]: true }));
    }
  }, []);

  useEffect(() => {
    fetch("/api/creations/mine")
      .then((response) => response.ok ? response.json() as Promise<Product[]> : Promise.reject())
      .then((items) => { setProducts(items); items.forEach((item) => void loadHistory(item.id)); })
      .catch(() => setError("请先登录后查看自己的产品"))
      .finally(() => setLoading(false));
  }, [loadHistory]);

  function updateVisibility(productId: number, visibility: string) {
    setProducts((current) => current.map((item) => item.id === productId ? { ...item, visibility } : item));
    void loadHistory(productId);
  }

  function removeProduct(productId: number) {
    setProducts((current) => current.filter((item) => item.id !== productId));
    setHistories((current) => { const next = { ...current }; delete next[productId]; return next; });
    setHistoryErrors((current) => { const next = { ...current }; delete next[productId]; return next; });
  }

  return <main className="min-h-dvh bg-[#f7f7f4] text-[#171717]">
    <header className="border-b border-black/10"><div className="mx-auto flex h-16 max-w-4xl items-center px-5"><Link href="/" className="inline-flex items-center gap-2 text-sm text-black/50"><ArrowLeft size={16} />返回发现</Link></div></header>
    <section className="mx-auto max-w-4xl px-5 py-12">
      <p className="text-sm text-black/45">产品内容</p><h1 className="mt-2 text-4xl font-semibold tracking-[-.06em]">我的产品</h1><p className="mt-4 max-w-xl text-sm leading-6 text-black/55">从第一次发布到现在，每一次变化都会沿着生命线留下来。</p>
      {loading ? <div className="mt-12 space-y-4" aria-busy="true" aria-label="正在读取产品"><div className="h-20 animate-pulse bg-black/[.04]" /><div className="h-64 animate-pulse bg-black/[.04]" /></div> : error ? <div className="mt-10 border border-black/10 bg-white p-7"><p className="text-sm text-black/55">{error}</p><Link href="/login?next=/account/products" className="mt-5 inline-block rounded-full bg-black px-5 py-3 text-sm text-white">去登录</Link></div> : products.length ? <div className="mt-10 space-y-12">
        {products.map((product) => <article key={product.id} className="border-y border-black/10 py-6">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-semibold tracking-[-.05em]">{product.title}</h2><span className="border border-black/10 px-2 py-1 text-[10px] text-black/55">{product.visibility === "published" ? "上架中" : product.visibility === "unpublished" ? "已下架" : product.visibility === "private" ? "仅自己可见" : product.visibility === "private_pending" ? "正在保存私密作品" : product.visibility === "finalizing" ? "正在保存" : product.visibility === "deleting" ? "正在删除" : "草稿"}</span></div><p className="mt-2 max-w-xl text-sm leading-6 text-black/50">{product.description}</p><p className="mt-2 text-xs text-black/35">{product.latest_version ? `${product.latest_version} 次发布` : "尚未发布"} · 当前喜欢 {product.likes_total}</p></div><ProductControls id={product.id} slug={product.slug} title={product.title} visibility={product.visibility} contactEmailVisible={Boolean(product.contact_email_visible)} onVisibilityChange={(visibility) => updateVisibility(product.id, visibility)} onDeleted={() => removeProduct(product.id)} /></div>
          {histories[product.id] ? <LifeLine versions={histories[product.id].versions} events={histories[product.id].events} currentLikes={product.likes_total} /> : historyErrors[product.id] ? <div className="mt-7 border-l border-black/15 py-4 pl-5" role="alert"><p className="text-sm text-black/50">生命线暂时没有读取成功。</p><button onClick={() => void loadHistory(product.id)} className="mt-3 inline-flex items-center gap-2 text-xs font-medium underline underline-offset-4"><RefreshCw size={13} />重新读取</button></div> : <div className="mt-7 h-40 animate-pulse border-l border-black/10 bg-black/[.025]" aria-label="正在读取生命线" />}
        </article>)}
      </div> : <div className="mt-10 border border-dashed border-black/15 bg-white p-10 text-center"><p className="text-sm text-black/50">你还没有发布产品。</p><Link href="/create" className="mt-4 inline-block border-b border-black text-sm">发布第一个产品</Link></div>}
    </section>
  </main>;
}
