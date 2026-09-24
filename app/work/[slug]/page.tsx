"use client";

import ProductDetail from "./product-detail-reported";

export default function WorkPage({ params }: { params: Promise<{ slug: string }> }) {
  return <ProductDetail params={params} />;
}
