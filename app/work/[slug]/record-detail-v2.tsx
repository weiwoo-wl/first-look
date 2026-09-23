"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, Play } from "lucide-react";

type Media = { object_key: string; media_type: string };
type Work = { title: string; description: string; type: string; status: string; story: string; creator_name: string; media: Media[] };

function source(media?: Media) {
  return media ? `/api/media/file?key=${encodeURIComponent(media.object_key)}` : "";
}

export default function RecordDetailV2({ params }: { params: Promise<{ slug: string }> }) {
  const [work, setWork] = useState<Work | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    params
      .then(({ slug }) => fetch(`/api/creations?slug=${encodeURIComponent(slug)}`))
      .then((response) => response.ok ? response.json() as Promise<Work> : Promise.reject())
      .then(setWork)
      .catch(() => setError("没有找到这件作品"));
  }, [params]);

  if (error) return <main className="record-detail-state"><p>{error}</p><Link href="/">回到唱片店</Link></main>;
  if (!work) return <main className="record-detail-state"><div className="detail-loader" /><p>正在取出唱片</p></main>;

  const current = work.media?.[index];
  const currentSource = source(current);
  const hasMultiple = work.media?.length > 1;

  return (
    <main className="record-detail-page">
      <header className="detail-nav"><Link href="/"><ArrowLeft size={17} /> 返回唱片架</Link><b>FIRST LOOK RECORDS</b><span>{String(index + 1).padStart(2, "0")} / {String(Math.max(work.media?.length || 1, 1)).padStart(2, "0")}</span></header>
      <section className="detail-layout">
        <div className="detail-media-area">
          <div className="detail-media">
            {current?.media_type === "video" ? <video src={currentSource} controls playsInline className="detail-asset" /> : currentSource ? <img src={currentSource} alt={work.title} className="detail-asset" /> : <div className="detail-placeholder"><small>{work.type}</small><strong>{work.title}</strong><span>FIRST LOOK RECORDS</span></div>}
            {current?.media_type === "video" && <span className="detail-video-mark"><Play size={16} fill="currentColor" /> 视频</span>}
          </div>
          {hasMultiple && <div className="detail-tracklist" aria-label="作品媒体列表">{work.media.map((media, mediaIndex) => <button key={media.object_key} className={mediaIndex === index ? "active" : ""} onClick={() => setIndex(mediaIndex)}><span>{String(mediaIndex + 1).padStart(2, "0")}</span><b>{media.media_type === "video" ? "视频" : "图片"}</b><i>{mediaIndex === index ? "正在展示" : "打开"}</i></button>)}</div>}
          {hasMultiple && <div className="detail-mobile-controls"><button onClick={() => setIndex((index - 1 + work.media.length) % work.media.length)}><ArrowLeft /></button><span>{index + 1} / {work.media.length}</span><button onClick={() => setIndex((index + 1) % work.media.length)}><ArrowRight /></button></div>}
        </div>
        <aside className="detail-notes">
          <div className="detail-classification"><span>{work.type}</span><span>{work.status}</span></div>
          <h1>{work.title}</h1>
          <p className="detail-intro">{work.description}</p>
          <dl><div><dt>创作者</dt><dd>{work.creator_name}</dd></div><div><dt>收录于</dt><dd>First Look Records</dd></div></dl>
          {work.story && <div className="detail-story"><h2>创作故事</h2><p>{work.story}</p></div>}
          <button className="detail-share" onClick={async () => { await navigator.clipboard.writeText(location.href); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? "链接已复制" : "复制分享链接"}</button>
        </aside>
      </section>
    </main>
  );
}
