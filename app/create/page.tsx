"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, Upload } from "lucide-react";

const types = ["工具", "小程序", "网页", "视频", "数字人", "Skill", "图片", "音频", "文本", "实验", "其他"];
const statuses = ["正在使用", "早期测试", "概念阶段"];

export default function CreatePage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [story, setStory] = useState("");
  const [type, setType] = useState("工具");
  const [status, setStatus] = useState("早期测试");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");

  function chooseFile(file?: File) {
    if (!file) return;
    setFileName(file.name);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setPreview(String(reader.result));
      reader.readAsDataURL(file);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formTitle = (event.currentTarget.querySelector("input") as HTMLInputElement)?.value || title;
    const formDescription = (event.currentTarget.querySelector("textarea") as HTMLTextAreaElement)?.value || description;
    const item = { title: formTitle, description: formDescription, maker: "我", type, status, story, preview, visibility: "published", color: "from-[#f2d9c7] to-[#d6a984]", likes: 0, comments: 0, badge: "刚刚发布" };
    const saved = JSON.parse(window.localStorage.getItem("first-look-creations") || "[]");
    window.localStorage.setItem("first-look-creations", JSON.stringify([item, ...saved]));
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 1500);
      const response = await fetch("/api/creations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: formTitle, description: formDescription, type, status, story }), signal: controller.signal });
      window.clearTimeout(timeout);
      if (response.status === 409) { window.alert("这个作品已经发布过了，请换一个作品名称。"); return; }
      if (response.ok) {
        const creation = await response.json() as { slug?: string };
        if (creation.slug) {
          window.location.href = `/?published=${encodeURIComponent(formTitle)}`;
          return;
        }
      }
    } catch {
      setError("发布暂时失败，请确认已经登录后再试。");
      return;
    }
    window.location.href = `/?published=${encodeURIComponent(formTitle)}`;
  }

  return (
    <main className="min-h-dvh bg-[#f7f7f4] text-[#171717]"><header className="border-b border-black/10"><div className="mx-auto flex h-[68px] max-w-3xl items-center px-5 lg:px-0"><Link href="/" className="inline-flex items-center gap-2 text-sm text-black/55 hover:text-black"><ArrowLeft size={16} />返回发现</Link></div></header><section className="mx-auto max-w-3xl px-5 py-12 lg:px-0 lg:py-16"><p className="mb-3 text-sm font-medium text-[#e15d36]">分享你的创造</p><h1 className="text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">让它被看见。</h1><p className="mt-4 text-black/55">不用写商业介绍，告诉大家你做了什么，以及如何体验。</p><form onSubmit={submit} className="mt-10 space-y-7"><label className="block"><span className="mb-2 block text-sm font-medium">作品名称</span><input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：一个会写诗的数字人" className="w-full rounded-lg border border-black/15 bg-white px-4 py-3 outline-none focus:border-black" /></label><label className="block"><span className="mb-2 block text-sm font-medium">一句话介绍</span><textarea required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="它能帮别人做什么？" rows={3} className="w-full resize-none rounded-lg border border-black/15 bg-white px-4 py-3 outline-none focus:border-black" /></label><fieldset><legend className="mb-2 text-sm font-medium">作品类型</legend><div className="flex flex-wrap gap-2">{types.map((item) => <button type="button" key={item} onClick={() => setType(item)} className={`rounded-full border px-4 py-2 text-sm ${type === item ? "border-black bg-black text-white" : "border-black/15 bg-white text-black/55"}`}>{item}</button>)}</div></fieldset><fieldset><legend className="mb-2 text-sm font-medium">当前状态</legend><div className="flex flex-wrap gap-2">{statuses.map((item) => <button type="button" key={item} onClick={() => setStatus(item)} className={`rounded-full border px-4 py-2 text-sm ${status === item ? "border-black bg-black text-white" : "border-black/15 bg-white text-black/55"}`}>{item}</button>)}</div></fieldset><label className="block"><span className="mb-2 block text-sm font-medium">为什么做？<span className="font-normal text-black/35">（选填）</span></span><textarea value={story} onChange={(e) => setStory(e.target.value)} placeholder="分享一点创作背后的想法" rows={3} className="w-full resize-none rounded-lg border border-black/15 bg-white px-4 py-3 outline-none focus:border-black" /></label><label className="block"><span className="mb-2 block text-sm font-medium">上传产品图片或视频</span><span className="relative flex min-h-40 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-black/20 bg-white text-center transition hover:border-black/50">{preview && <img src={preview} alt="作品预览" className="absolute inset-0 h-full w-full object-cover opacity-70" />}<span className="relative flex flex-col items-center"><Upload size={20} className="mb-2 text-black/45" /><span className="text-sm">点击上传产品图片或视频</span><span className="mt-1 text-xs text-black/40">{fileName || "支持 JPG、PNG、MP4 等格式"}</span></span><input type="file" accept="image/*,video/*" onChange={(e) => chooseFile(e.target.files?.[0])} className="sr-only" /></span></label><button type="submit" className="w-full rounded-full bg-black px-5 py-3.5 text-sm font-medium text-white transition hover:bg-[#333]">发布作品</button></form></section></main>
  );
}
