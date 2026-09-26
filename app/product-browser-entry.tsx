"use client";
import ProductBrowserHome from "./product-browser-home";

export default function ProductBrowserEntry() {
  return <><ProductBrowserHome /><a href="/account" className="fixed right-5 top-[82px] z-40 rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-black hover:text-white max-[700px]:right-4 max-[700px]:top-[74px] max-[700px]:px-3 max-[700px]:py-1.5 max-[700px]:text-xs">创作者中心</a></>;
}
