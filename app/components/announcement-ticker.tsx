"use client";
import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import type { Announcement } from "../lib/announcements";

export default function AnnouncementTicker() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/announcements", { cache: "no-store", signal: controller.signal })
      .then(response => response.ok ? response.json() as Promise<{ announcements: Announcement[] }> : { announcements: [] })
      .then(result => setItems(result.announcements || [])).catch(() => undefined);
    return () => controller.abort();
  }, []);
  if (!items.length) return null;
  const characters = items.reduce((total, item) => total + item.title.length + item.content.length, 0);
  const repetitions = Math.max(1, Math.ceil(200 / Math.max(8, characters)));
  return <aside className={`announcement-ticker${paused ? " is-paused" : ""}`} aria-label="网站公告">
    <span className="announcement-label"><i aria-hidden="true" />公告</span>
    <div className="announcement-window" tabIndex={0}>
      <div className="announcement-track" style={{ animationDuration: `${Math.max(24, characters * repetitions / 4)}s` }}>
        {[0, 1].map(copy => <div className="announcement-group" key={copy} aria-hidden={copy === 1 || undefined}>
          {Array.from({ length: repetitions }, (_, repeat) => items.map(item => <span className="announcement-item" key={`${repeat}:${item.id}`} aria-hidden={repeat > 0 || undefined}>
            {item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer" tabIndex={copy || repeat ? -1 : undefined}><strong>{item.title}</strong><span>{item.content}</span><span aria-hidden="true">↗</span></a> : <span><strong>{item.title}</strong><span>{item.content}</span></span>}
            <b className="announcement-separator" aria-hidden="true">·</b>
          </span>))}
        </div>)}
      </div>
    </div>
    <button type="button" onClick={() => setPaused(value => !value)} aria-label={paused ? "继续滚动公告" : "暂停滚动公告"} aria-pressed={paused}>{paused ? <Play size={14} /> : <Pause size={14} />}</button>
  </aside>;
}
