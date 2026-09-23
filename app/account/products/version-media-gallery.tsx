"use client";

import { Play, Search } from "lucide-react";
import { useMemo, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Video from "yet-another-react-lightbox/plugins/video";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";

export type VersionMedia = { object_key: string; media_type: string; mime_type?: string };

function mediaUrl(key: string) { return `/api/media/file?key=${encodeURIComponent(key)}`; }

export default function VersionMediaGallery({ media, title }: { media: VersionMedia[]; title: string }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const slides = useMemo(() => media.map((item) => item.media_type === "video" ? {
    type: "video" as const,
    sources: [{ src: mediaUrl(item.object_key), type: item.mime_type || "video/mp4" }],
    controls: true,
    autoPlay: false,
    preload: "metadata",
    playsInline: true,
  } : { src: mediaUrl(item.object_key), alt: `${title} 的历史版本图片` }), [media, title]);

  function showMedia(mediaIndex: number) { setIndex(mediaIndex); setOpen(true); }

  return <>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {media.map((item, mediaIndex) => {
        const video = item.media_type === "video";
        return <button key={item.object_key} type="button" onClick={() => showMedia(mediaIndex)} aria-label={`${video ? "播放视频" : "查看大图"}：${title}，第 ${mediaIndex + 1} 项`} className="group relative aspect-square overflow-hidden rounded-sm bg-black/5 outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">
          {video ? <video src={mediaUrl(item.object_key)} muted preload="metadata" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" /> : <img src={mediaUrl(item.object_key)} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />}
          <span className="absolute inset-0 grid place-items-center bg-black/0 text-white transition-colors group-hover:bg-black/20 group-focus-visible:bg-black/20"><span className="grid h-10 w-10 place-items-center rounded-full bg-black/55 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{video ? <Play size={17} fill="currentColor" /> : <Search size={17} />}</span></span>
        </button>;
      })}
    </div>
    <Lightbox
      open={open}
      close={() => setOpen(false)}
      index={index}
      slides={slides}
      plugins={[Zoom, Video]}
      on={{ view: ({ index: nextIndex }) => setIndex(nextIndex) }}
      labels={{ Previous: "上一项", Next: "下一项", Close: "关闭", Slide: "媒体", Carousel: "媒体浏览器", Lightbox: `${title} 的历史媒体`, "Photo gallery": "历史媒体", "{index} of {total}": "第 {index} 项，共 {total} 项", "Zoom in": "放大", "Zoom out": "缩小" }}
      toolbar={{ buttons: [<span key="counter" className="mr-2 self-center text-xs tabular-nums text-white/70">{index + 1} / {slides.length}</span>, "zoom", "close"] }}
      video={{ controls: true, autoPlay: false, preload: "metadata", playsInline: true }}
      zoom={{ scrollToZoom: true, maxZoomPixelRatio: 3 }}
      carousel={{ finite: media.length < 2 }}
      className="first-look-lightbox"
    />
  </>;
}
