import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") || "softform.example.com";
  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  const protocol = forwardedProto || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "SOFTFORM 柔造｜让灵感长出形状",
    description: "治愈而细腻的 3D 打印工作室。挑选现成作品，或上传一张照片，让我们把你的灵感变成可以触摸的形状。",
    icons: { icon: "/softform-icon.png", shortcut: "/softform-icon.png" },
    openGraph: {
      title: "SOFTFORM 柔造｜让灵感长出形状",
      description: "上传一张照片，把你的灵感变成可以触摸的形状。",
      images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "SOFTFORM 柔造，让灵感长出形状" }],
    },
    twitter: { card: "summary_large_image", images: [`${origin}/og.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
