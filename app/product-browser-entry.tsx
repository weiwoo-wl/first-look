"use client";
import ProductBrowserHome from "./product-browser-home";

export default function ProductBrowserEntry() {
  return <><ProductBrowserHome /><a href="/account/products" className="fixed right-5 top-[82px] z-40 rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-black hover:text-white">我的产品</a></>;
}
