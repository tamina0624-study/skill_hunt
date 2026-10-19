import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Safety Quest",
  description: "ヒヤリハットを改善クエストへ変えるAIコーチ",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
