"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function SiteVisitTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname?.startsWith("/admin")) return;
    fetch("/api/analytics/visit", { method: "POST", credentials: "same-origin", keepalive: true }).catch(() => {});
  }, [pathname]);
  return null;
}
