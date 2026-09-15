import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "First Look — AI 创造，值得被看见",
  description: "发现正在被创造的 AI 产品。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/koi-logo.svg",
    shortcut: "/koi-logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
