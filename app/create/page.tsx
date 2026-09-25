"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MediaCreateForm from "./media-create-form";

type GateState = "checking" | "ready" | "error";

export default function CreatePage() {
  const [state, setState] = useState<GateState>("checking");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<{ user: unknown | null }> : Promise.reject())
      .then((session) => {
        if (!active) return;
        if (!session.user) {
          window.location.replace("/login?next=/create");
          return;
        }
        setState("ready");
      })
      .catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, []);

  if (state === "checking") return <Gate message="正在检查登录状态…" />;
  if (state === "error") return <Gate message="暂时无法确认登录状态" retry />;
  return <MediaCreateForm />;
}

function Gate({ message, retry = false }: { message: string; retry?: boolean }) {
  return <main className="grid min-h-dvh place-items-center bg-[#f7f7f4] px-5 text-[#171717]"><section className="text-center"><p className="text-sm text-black/50">{message}</p>{retry && <div className="mt-5 flex justify-center gap-3"><button onClick={() => window.location.reload()} className="rounded-full bg-black px-5 py-2.5 text-sm text-white">重试</button><Link href="/" className="rounded-full border border-black/15 px-5 py-2.5 text-sm">返回首页</Link></div>}</section></main>;
}
