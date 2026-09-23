import { ArrowLeft, LockKeyhole } from "lucide-react";
import Link from "next/link";

export default function ArchivedProductPage() {
  return <main className="grid min-h-dvh place-items-center bg-[#f7f7f4] px-5 text-[#171717]">
    <section className="w-full max-w-lg border-y border-black/10 py-10 text-center">
      <LockKeyhole className="mx-auto text-black/35" size={28} />
      <p className="mt-6 text-xs font-semibold tracking-wider text-black/40">发布记录</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-.05em]">已发布产品不能修改</h1>
      <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-black/55">每次发布都会成为不可改写的记录。你仍然可以在“我的产品”中下架、重新上架或删除整个产品。</p>
      <Link href="/account/products" className="mt-7 inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm text-white"><ArrowLeft size={15} />返回我的产品</Link>
    </section>
  </main>;
}
