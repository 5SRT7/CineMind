import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CineMind - AI 电影搜索与发现",
    template: "%s | CineMind",
  },
  description:
    "用自然语言描述你想看的电影，CineMind 会理解需求、检索 TMDB 候选，并解释为什么推荐这些电影。",
  openGraph: {
    title: "CineMind - AI 电影搜索与发现",
    description: "自然语言电影搜索、RAG 语义检索与 AI 推荐解释。",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN" className="min-h-full antialiased">
      <body className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
