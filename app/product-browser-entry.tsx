"use client";
import ProductBrowserHome from "./product-browser-home";

export default function ProductBrowserEntry() {
  return <><ProductBrowserHome /><a href="/account" className="fixed right-5 top-[82px] z-40 rounded-full border border-[#28443d] bg-[#28443d] px-4 py-2 text-sm font-medium text-white shadow-md transition-colors hover:border-[#1d332e] hover:bg-[#1d332e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28443d] focus-visible:ring-offset-2 max-[700px]:right-4 max-[700px]:top-[74px] max-[700px]:px-3 max-[700px]:py-2 max-[700px]:text-xs">创作者中心</a></>;
}
