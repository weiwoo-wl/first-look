"use client";

import { useState } from "react";
import { isWebResourceLink, resourceLinkTitle } from "../lib/technical";

export default function ProductEntryAction({ value, className = "" }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const isLink = isWebResourceLink(value);
  const isMiniProgram = value.trim().startsWith("#小程序://");

  async function copyEntry() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const label = isLink ? "打开产品 ↗" : isMiniProgram ? "复制小程序口令" : "复制产品入口";
  const style = `inline-flex w-fit items-center justify-center rounded-full bg-black px-4 py-2 text-xs font-medium text-white transition hover:bg-black/75 ${className}`;

  return isLink ? (
    <a href={value} target={/^https?:\/\//i.test(value) ? "_blank" : undefined} rel={/^https?:\/\//i.test(value) ? "noreferrer" : undefined} className={style} onClick={(event) => event.stopPropagation()}>
      {label}
    </a>
  ) : (
    <div className="flex flex-col items-start gap-1.5">
      <button type="button" className={style} onClick={(event) => { event.stopPropagation(); void copyEntry(); }}>
        {copied ? "已复制" : label}
      </button>
      <span className="text-[11px] text-black/40">{copied ? "可前往对应平台打开" : isMiniProgram ? "复制后在微信中打开" : `复制后在${resourceLinkTitle(value)}中打开`}</span>
    </div>
  );
}
