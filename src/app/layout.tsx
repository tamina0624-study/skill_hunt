import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "skill hant",
  description: "ヒヤリハットを改善クエストへ変えるAIコーチ",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
