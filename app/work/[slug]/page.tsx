import type { Metadata } from "next";
import { runtime } from "../../lib/auth";
import { ensureCreationTables } from "../../lib/creations";
import ProductDetail from "./product-detail";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  try {
    const { slug } = await params, db = runtime().DB;
    if (!db) return {};
    await ensureCreationTables(db);
    const product = await db.prepare("SELECT id,title,description FROM creations WHERE slug=? AND visibility='published'").bind(slug).first<{ id: number; title: string; description: string }>();
    if (!product) return {};
    const cover = await db.prepare("SELECT object_key FROM creation_media WHERE creation_id=? AND media_type='image' ORDER BY sort_order LIMIT 1").bind(product.id).first<{ object_key: string }>();
    const url = `https://firstlooklab.cn/work/${encodeURIComponent(slug)}`;
    const image = cover ? `https://firstlooklab.cn/api/media/file?key=${encodeURIComponent(cover.object_key)}` : "https://firstlooklab.cn/koi-logo.png";
    return {
      title: `${product.title} | First Look`,
      description: product.description,
      openGraph: { title: product.title, description: product.description, url, siteName: "First Look", type: "website", images: [{ url: image }] },
      twitter: { card: cover ? "summary_large_image" : "summary", title: product.title, description: product.description, images: [image] },
    };
  } catch {
    return {};
  }
}

export default function WorkPage({ params }: { params: Promise<{ slug: string }> }) {
  return <ProductDetail />;
}
