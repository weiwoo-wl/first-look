"use client";

import QRCode from "qrcode";
import { Check, Download, Share2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type PosterMedia = { object_key: string; media_type: string };

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片读取失败"));
    image.src = src;
  });
}

function loadVideoFrame(src: string) {
  return new Promise<HTMLVideoElement>((resolve, reject) => {
    const video = document.createElement("video");
    const timeout = window.setTimeout(() => reject(new Error("视频封面读取超时")), 8000);
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onloadeddata = () => {
      window.clearTimeout(timeout);
      resolve(video);
    };
    video.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error("视频封面读取失败"));
    };
    video.src = src;
    video.load();
  });
}

function drawCover(ctx: CanvasRenderingContext2D, source: CanvasImageSource, width: number, height: number) {
  const sourceWidth = source instanceof HTMLVideoElement ? source.videoWidth : source instanceof HTMLImageElement ? source.naturalWidth : (source as HTMLCanvasElement).width;
  const sourceHeight = source instanceof HTMLVideoElement ? source.videoHeight : source instanceof HTMLImageElement ? source.naturalHeight : (source as HTMLCanvasElement).height;
  if (!sourceWidth || !sourceHeight) return;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const cropWidth = width / scale, cropHeight = height / scale;
  ctx.drawImage(source, (sourceWidth - cropWidth) / 2, (sourceHeight - cropHeight) / 2, cropWidth, cropHeight, 0, 0, width, height);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const lines: string[] = [];
  let line = "";
  for (const char of Array.from(text)) {
    if (line && ctx.measureText(line + char).width > maxWidth) {
      lines.push(line);
      line = char;
      if (lines.length === maxLines) break;
    } else line += char;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && text.length > lines.join("").length) {
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
  }
  lines.forEach((value, index) => ctx.fillText(value, x, y + index * lineHeight));
}

export default function ProductSharePoster({ open, onClose, title, description, slug, media, onShared }: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  slug: string;
  media: PosterMedia[];
  onShared: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const cover = media.find((item) => item.media_type === "image") || media[0];
  const coverKey = cover?.object_key;
  const coverType = cover?.media_type;

  useEffect(() => {
    if (!open) return;
    let active = true;
    async function renderPoster() {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) throw new Error("当前浏览器无法生成海报");
      const width = 900, height = 1200;
      canvas.width = width;
      canvas.height = height;
      ctx.fillStyle = "#f7f7f4";
      ctx.fillRect(0, 0, width, height);

      const logo = await loadImage("/koi-logo.png").catch(() => null);
      if (coverKey && coverType) {
        const mediaUrl = `/api/media/file?key=${encodeURIComponent(coverKey)}`;
        try {
          const imageOrVideo = coverType === "image" ? await loadImage(mediaUrl) : await loadVideoFrame(mediaUrl);
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(48, 126, 804, 530, 22);
          ctx.clip();
          ctx.fillStyle = "#ded6c8";
          ctx.fillRect(48, 126, 804, 530);
          drawCover(ctx, imageOrVideo, 804, 530);
          ctx.restore();
          if (imageOrVideo instanceof HTMLVideoElement) imageOrVideo.pause();
        } catch {
          ctx.fillStyle = "#e5dfd4";
          ctx.fillRect(48, 126, 804, 530);
          if (logo) ctx.drawImage(logo, 360, 295, 180, 180);
        }
      } else {
        ctx.fillStyle = "#e5dfd4";
        ctx.fillRect(48, 126, 804, 530);
        if (logo) ctx.drawImage(logo, 360, 295, 180, 180);
      }

      if (logo) ctx.drawImage(logo, 52, 42, 54, 54);
      ctx.fillStyle = "#171717";
      ctx.font = "700 30px Arial, sans-serif";
      ctx.fillText("FIRST LOOK", 122, 78);
      ctx.fillStyle = "#74716b";
      ctx.font = "22px Arial, sans-serif";
      ctx.fillText("一眼发现新作品", 124, 108);

      ctx.fillStyle = "#171717";
      ctx.font = "700 48px Arial, sans-serif";
      wrapText(ctx, title, 58, 730, 784, 62, 2);
      ctx.fillStyle = "#5d5b56";
      ctx.font = "26px Arial, sans-serif";
      wrapText(ctx, description, 60, 875, 784, 39, 2);

      ctx.strokeStyle = "#d9d6cf";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(58, 982);
      ctx.lineTo(842, 982);
      ctx.stroke();
      ctx.fillStyle = "#171717";
      ctx.font = "600 24px Arial, sans-serif";
      ctx.fillText("扫码查看产品", 60, 1040);
      ctx.fillStyle = "#77736c";
      ctx.font = "20px Arial, sans-serif";
      ctx.fillText("firstlooklab.cn", 60, 1080);

      const qrUrl = new URL(`/work/${encodeURIComponent(slug)}`, location.origin).toString();
      const qrData = await QRCode.toDataURL(qrUrl, { errorCorrectionLevel: "M", margin: 1, width: 240 });
      const qrImage = await loadImage(qrData);
      ctx.fillStyle = "#fff";
      ctx.fillRect(638, 992, 210, 198);
      ctx.drawImage(qrImage, 643, 995, 200, 200);
      if (active) setReady(true);
    }
    renderPoster().catch((renderError: unknown) => {
      if (active) setError(renderError instanceof Error ? renderError.message : "海报生成失败，请重试");
    });
    return () => { active = false; };
  }, [open, title, description, slug, coverKey, coverType]);

  async function makeFile() {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error("海报还没有准备好");
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("图片导出失败")), "image/png"));
    return new File([blob], `First-Look-${slug}.png`, { type: "image/png" });
  }

  function download(file: File) {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function savePoster() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const file = await makeFile();
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          setMessage("系统菜单已处理海报；如果刚才选择了“存储图像”，图片就在照片里。");
        } catch (shareError) {
          if (shareError instanceof DOMException && shareError.name === "AbortError") return;
          download(file);
          setMessage("已生成海报下载；若要存到照片，请打开图片后选择添加到照片。");
        }
      } else {
        download(file);
        setMessage("已开始下载海报；手机可打开图片后选择添加到照片。");
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存海报失败");
    } finally {
      setBusy(false);
    }
  }

  async function sharePoster() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const file = await makeFile();
      if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
        download(file);
        setMessage("此浏览器不能直接分享图片，海报已开始下载，可从微信相册中发送。");
        return;
      }
      try {
        await navigator.share({ files: [file] });
        onShared();
        setMessage("分享菜单已打开；也可以在菜单中选择存储图像。");
      } catch (shareError) {
        if (shareError instanceof DOMException && shareError.name === "AbortError") return;
        download(file);
        setMessage("分享没有完成，海报已开始下载；可以从微信相册中发送。");
      }
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : "生成分享图片失败");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-black/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="share-poster-title" className="flex max-h-[94svh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-[#f7f7f4] shadow-2xl">
      <header className="flex items-center justify-between border-b border-black/10 px-5 py-4">
        <div><p className="text-xs text-black/45">产品分享</p><h2 id="share-poster-title" className="mt-1 text-lg font-semibold">海报预览</h2></div>
        <button type="button" onClick={onClose} aria-label="关闭海报预览" className="rounded-full p-2 hover:bg-black/5"><X size={20} /></button>
      </header>
      <div className="min-h-0 overflow-y-auto p-4">
        <div className="mx-auto flex min-h-56 max-w-[360px] items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm">
          <canvas ref={canvasRef} aria-label={`${title}分享海报预览`} className={`h-auto w-full ${ready ? "block" : "hidden"}`} />
          {!ready && <p className="p-8 text-sm text-black/50">{error || "正在生成海报…"}</p>}
        </div>
        <p className="mx-auto mt-3 max-w-[360px] text-center text-xs leading-5 text-black/50">iPhone 点“保存图片”后，在系统菜单选“存储图像”即可存入照片；微信若未正常打开，可从相册发送海报。二维码可直接打开此产品。</p>
      </div>
      <footer className="border-t border-black/10 p-4">
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => void sharePoster()} disabled={!ready || busy} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-black px-5 text-sm font-medium text-white disabled:opacity-40"><Share2 size={16} />分享海报</button>
          <button type="button" onClick={() => void savePoster()} disabled={!ready || busy} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-black/15 bg-white px-5 text-sm font-medium disabled:opacity-40">{message.includes("存储图像") ? <Check size={16} /> : <Download size={16} />}保存图片</button>
        </div>
        {message && <p role="status" className="mt-3 text-center text-sm text-emerald-800">{message}</p>}
        {error && <p role="alert" className="mt-3 text-center text-sm text-red-600">{error}</p>}
      </footer>
    </section>
  </div>;
}
