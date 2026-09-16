import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "First Look — AI 创造，值得被看见",
  description: "让每一个用 AI 创造的产品，尤其是非专业创造者的产品，都有被发现的机会。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/koi-logo.png",
    shortcut: "/koi-logo.png",
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
