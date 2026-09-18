# Safety Quest

Safety Quest は、日々の業務経験を「ナレッジ」「スキル」「実績」として記録し、AI ベースの評価ルールでポイント化し、成長を可視化するための MVP アプリです。

## 概要

本アプリは、IT エンジニアが以下を継続的に蓄積できるようにすることを目的としています。

- 気づきや学びをナレッジとして残す
- 身につけたスキルを記録する
- 達成した実績を蓄積する
- KP / SP / AP をもとに EP として成長を可視化する
- 月次レポートで進捗と次のアクションを確認する

現在の実装は、Next.js + Prisma + Supabase PostgreSQL を前提とした DB 連携版の MVP です。

## 現在の実装状況

### 実装済み

- Next.js 15 / App Router
- React 19 / TypeScript
- Prisma schema 定義
- Supabase PostgreSQL 連携
- API Routes
  - `/api/knowledge`
  - `/api/skills`
  - `/api/achievements`
  - `/api/reports`
  - `/api/ai`
- ダッシュボード
- ナレッジ登録
- 獲得スキル登録
- 実績登録
- 登録一覧検索
- 月次レポート生成
- AI 評価の fallback 実装
- DB 初期化済みのデータ保存フロー

### 今後の対応

- Supabase Auth による実ユーザー管理
- 各ユーザーごとのデータ分離
- OpenRouter 実連携の本実装
- 月次通知の自動送信
- レポートの永続化と履歴管理の強化
- エラー処理と validation の整備

## 主要機能

### ダッシュボード

- 今月のナレッジ数
- 累計ナレッジ数
- EP 成長の推移
- AI 評価コメント

### ナレッジ登録

- 発生日時、影響の有無、ステータス
- 対象、学びの内容
- 任意詳細
- 機密情報確認
- AI によるポイント計算

### スキル登録

- 年月とスキル名を入力
- SP 判定と理由を保存

### 実績登録

- 年月と実績名を入力
- AP 判定と理由を保存

### 一覧検索

- 種別横断検索
- キーワード検索
- ステータス絞り込み

### 月次レポート

- 指定月のナレッジ / スキル / 実績を集計
- 月次評価とエンジニア力評価を出力
- 同一月のレポートは upsert で保持

## 技術スタック

- Next.js 15
- React 19
- TypeScript
- Prisma
- PostgreSQL (Supabase)
- OpenRouter 対応の AI 評価基盤

## ディレクトリ構成

```text
.
├── doc/                        # 要件・設計書
│   ├── 01_requirements_specification.md
│   ├── 02_basic_design.md
│   ├── 03_detailed_design.md
│   ├── 04_test_specification.md
│   └── 05_current_database_design.md
├── gui_mock/                   # UI モック
├── prisma/
│   └── schema.prisma           # Prisma schema
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── ai/
│   │   │   ├── achievements/
│   │   │   ├── health/
│   │   │   ├── knowledge/
│   │   │   ├── reports/
│   │   │   └── skills/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── lib/
│       ├── ai.ts
│       └── prisma.ts
├── .gitignore
├── eslint.config.mjs
├── next-env.d.ts
├── next.config.ts
├── package.json
├── tsconfig.json
├── README.md
└── ...
```

## 環境変数

ローカル開発時は `.env` に以下を設定します。

```env
DATABASE_URL="postgresql://postgres:xxx@db.xxx.supabase.co:5432/postgres?sslmode=require"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
OPENROUTER_API_KEY="your_openrouter_api_key"
OPENROUTER_MODEL="openai/gpt-4o-mini"
```

### 補足

- Prisma は Supabase の direct connection を前提に接続しています。
- `OPENROUTER_API_KEY` が未設定の場合は、ローカルの fallback AI 評価ロジックが使われます。

## ローカルセットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Prisma の生成と DB 同期

```bash
npx prisma generate
npx prisma db push
```

### 3. 開発サーバー起動

```bash
npm run dev
```

ブラウザで以下を開いてください。

```text
http://localhost:3000
```

## ビルド

```bash
npm run build
```

## Prisma 関連コマンド

```bash
npm run db:validate
npm run db:generate
npx prisma db push
```

## デプロイ手順

### 推奨構成: Vercel + Supabase

#### 1. GitHub に push

```bash
git add .
git commit -m "feat: final api integration"
git push origin main
```

#### 2. Vercel でプロジェクトを import

- Vercel にログイン
- 「Add Project」 を選択
- GitHub のリポジトリを選択
- Root Directory はそのまま
- Framework は Next.js を自動検出

#### 3. 環境変数を設定

Vercel の Project Settings → Environment Variables で以下を登録します。

```env
DATABASE_URL="postgresql://postgres:xxx@db.xxx.supabase.co:5432/postgres?sslmode=require"
NEXT_PUBLIC_APP_URL="https://your-app.vercel.app"
OPENROUTER_API_KEY="your_openrouter_api_key"
OPENROUTER_MODEL="openai/gpt-4o-mini"
```

#### 4. ビルドコマンドを確認

```bash
npm run build
```

#### 5. Deploy

- 「Deploy」 を実行
- 初回デプロイ後、データベースの schema を同期

```bash
npx prisma db push
```

必要に応じて Vercel の CLI で以下も実行できます。

```bash
npx vercel
npx prisma db push
```

### 代替構成: Render + Supabase

#### 1. Render で Web Service を作成

- GitHub リポジトリを接続
- Build Command

```bash
npm install && npx prisma generate && npm run build
```

- Start Command

```bash
npm run start
```

#### 2. 環境変数を登録

```env
DATABASE_URL="..."
NEXT_PUBLIC_APP_URL="https://your-render-url.onrender.com"
OPENROUTER_API_KEY="..."
OPENROUTER_MODEL="openai/gpt-4o-mini"
```

#### 3. 初回起動後に DB 反映

```bash
npx prisma db push
```

## 実運用に向けた注意点

- 現在は demo@example.com 固定ユーザーです。
- 実運用では Supabase Auth で明示的にログインユーザーを取得し、`userId` に応じてデータを分離する必要があります。
- Prisma は Supabase の direct connection を使う前提です。
- AI API はキー未設定時に fallback で動作するため、開発時は安全に使えます。

## ライセンス

本リポジトリのライセンスは未定義です。
