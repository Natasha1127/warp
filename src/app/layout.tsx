import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WARP — アダプティブ学習システム",
  description: "つまずいた場所を自動で検知し、最適なルートで理解を深める学習ナビゲーションシステム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
