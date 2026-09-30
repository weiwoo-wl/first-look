"use client";

import { useEffect, useState } from "react";

type Day = { day:string; visitors:number; users:number; products:number; views:number; likes:number; favorites:number; shares:number; shareOpens:number };

export default function AdminDashboard() {
  const [daily, setDaily] = useState<Day[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/admin/dashboard", { cache:"no-store" }).then(async response => {
      if (!response.ok) throw new Error("统计暂时无法加载");
      const result = await response.json() as { daily:Day[] };
      setDaily(result.daily);
    }).catch(() => setError("统计暂时无法加载，请刷新页面重试。"));
  }, []);

  if (error) return <section className="admin-panel admin-dashboard-block"><p className="admin-dashboard-note">{error}</p></section>;
  if (!daily) return <section className="admin-panel admin-dashboard-block"><p className="admin-dashboard-note">正在加载每日统计…</p></section>;

  const today = daily.at(-1)!;
  const yesterday = daily.at(-2)!;
  const maxVisitors = Math.max(1, ...daily.map(item => item.visitors));
  return <div className="admin-dashboard-block">
    <div className="admin-metrics admin-dashboard-metrics">
      <article><span>今日访客</span><strong>{today.visitors}</strong><small>昨天 {yesterday.visitors}</small></article>
      <article><span>今日产品浏览</span><strong>{today.views}</strong><small>昨天 {yesterday.views}</small></article>
      <article><span>今日新增用户</span><strong>{today.users}</strong><small>昨天 {yesterday.users}</small></article>
      <article><span>今日新增公开作品</span><strong>{today.products}</strong><small>昨天 {yesterday.products}</small></article>
    </div>
    <section className="admin-panel admin-dashboard-panel"><h2>近 7 天访客</h2><div className="admin-dashboard-chart">{daily.map(item => <div key={item.day} className="admin-dashboard-day" title={`${item.day}：${item.visitors} 位访客`}><span>{item.visitors}</span><div className="admin-dashboard-bar-track"><div className="admin-dashboard-bar" style={{height:`${Math.max(item.visitors ? 8 : 0, item.visitors/maxVisitors*100)}%`}} /></div><time>{item.day.slice(5)}</time></div>)}</div><p className="admin-dashboard-note">按北京时间统计；同一浏览器每天计一次。访客数据从统计功能上线后开始积累。</p></section>
    <section className="admin-panel admin-dashboard-panel"><h2>今日作品互动</h2><div className="admin-dashboard-engagement"><div><span>喜欢</span><strong>{today.likes}</strong></div><div><span>收藏</span><strong>{today.favorites}</strong></div><div><span>分享</span><strong>{today.shares}</strong></div><div><span>分享后打开</span><strong>{today.shareOpens}</strong></div></div></section>
  </div>;
}
