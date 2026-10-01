"use client";

import { useState } from "react";
import { extractSharedUrl, isWebResourceLink, resourceLinkTitle } from "../lib/technical";

export default function ProductEntryAction({ value, type = "", className = "" }: { value: string; type?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const sharedUrl = extractSharedUrl(value);
  const isLink = isWebResourceLink(value) || Boolean(sharedUrl);
  const target = sharedUrl || value;
  const isMiniProgram = type === "小程序" || value.includes("#小程序://");

  async function copyEntry() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const label = isLink ? "打开产品" : isMiniProgram ? "复制小程序分享内容" : "复制产品入口";
  const style = `inline-flex w-fit items-center justify-center rounded-full bg-black px-4 py-2 text-xs font-medium text-white transition hover:bg-black/75 ${className}`;

  return isLink ? (
    <a href={target} target={/^https?:\/\//i.test(target) ? "_blank" : undefined} rel={/^https?:\/\//i.test(target) ? "noreferrer" : undefined} className={style} onClick={(event) => event.stopPropagation()}>
      {label}
    </a>
  ) : (
    <div className="flex flex-col items-start gap-1.5">
      <button type="button" className={style} onClick={(event) => { event.stopPropagation(); void copyEntry(); }}>
        {copied ? "已复制" : label}
      </button>
      <span className="text-[11px] text-black/40">{isLink ? "分享内容中包含可打开的网址" : isMiniProgram ? "发到微信聊天，点击链接打开" : copied ? "已复制" : `复制后在${resourceLinkTitle(value)}中打开`}</span>
    </div>
  );
}
