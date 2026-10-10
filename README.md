# skill hant

## こんな困りごとはありませんか？

- 日々の業務で得た学びや工夫を記録しそびれ、あとから思い出せない
- できるようになったことが整理されず、自分の成長を説明しにくい
- 次に何を振り返り、伸ばせばよいのか分からない

skill hant は、業務で得た経験を「ナレッジ」「スキル」「実績」として記録し、成長の振り返りを支援するツールです。

| 困りごと | skill hantでできること |
|---|---|
| 学びや経験が散らばり、振り返れない | ナレッジ・スキル・実績を登録し、一覧検索でまとめて確認できます。 |
| 成長が見えず、説明しにくい | 各記録をポイント（KP / SP / AP）で評価し、合計のEPや推移をダッシュボードで確認できます。 |
| 次の行動が決めにくい | 月次レポートで登録内容を振り返り、評価や次のアクションを確認できます。 |

## ドキュメント・設計書

- [要件定義書](doc/01_requirements_specification.md)
- [基本設計書](doc/02_basic_design.md)
- [詳細設計書](doc/03_detailed_design.md)
- [テスト仕様書](doc/04_test_specification.md)
- [現行DB設計書](doc/05_current_database_design.md)
- [プロジェクト作成ルール](./プロジェクト作成ルール)
- [プロンプト集](prompts.txt)

## GUI

### ログイン

![skill hant のGUI](doc/gui-screenshot.png)

### ダッシュボード

![skill hantのダッシュボード](doc/gui-dashboard.png)

### ナレッジ登録

![skill hantのナレッジ登録画面](doc/gui-knowledge-entry.png)

skill hant は、日々の業務経験を「ナレッジ」「スキル」「実績」として記録し、AI ベースの評価ルールでポイント化し、成長を可視化するための MVP アプリです。

## 概要

本アプリは、IT エンジニアが以下を継続的に蓄積できるようにすることを目的としています。

- 気づきや学びをナレッジとして残す
- 身につけたスキルを記録する
- 達成した実績を蓄積する
- KP / SP / AP をもとに EP として成長を可視化する
- 月次レポートで進捗と次のアクションを確認する

現在の実装は、Next.js + Prisma + Supabase PostgreSQL を前提とした DB 連携版の MVP です。

## システム構成

```mermaid
flowchart LR
  User[利用者] --> UI[Next.js / React画面]
  UI <--> Store[(ブラウザ localStorage)]
  UI -->|APIリクエスト| Routes[Route Handlers<br/>knowledge / skills / achievements / reports / ai]
  Routes -->|データ操作| Prisma[Prisma Client]
  Prisma --> DB[(Supabase PostgreSQL)]
  Routes -->|評価要求| Evaluator[AI評価処理]
  Evaluator -->|APIキー設定時| OpenRouter[OpenRouter API]
  Evaluator -. APIキー未設定または呼び出し失敗 .-> Fallback[fallback評価]
```

画面は登録状態の保存・復元に `localStorage` を使い、業務データの取得・保存はRoute Handler経由でPostgreSQLと連携します。AI評価はOpenRouterを利用できない場合、アプリ内のfallback評価に切り替わります。

## DBテーブル構成

Prisma schemaのモデルと主なリレーションは次のとおりです。テーブル名は `@@map` で指定された名前、フィールド名はPrisma schema上の名前で記載しています。

```mermaid
erDiagram
  USERS ||--o{ KNOWLEDGE_ENTRIES : owns
  USERS ||--o{ ACQUIRED_SKILLS : owns
  USERS ||--o{ ACHIEVEMENT_RECORDS : owns
  USERS ||--o{ MONTHLY_REPORTS : owns
  USERS ||--o{ POINT_EVENTS : records
  KNOWLEDGE_ENTRIES o|--o{ POINT_EVENTS : awards
  ACQUIRED_SKILLS o|--o{ POINT_EVENTS : awards
  ACHIEVEMENT_RECORDS o|--o{ POINT_EVENTS : awards

  USERS {
    uuid id PK
    string email UK
    int totalEp
  }
  KNOWLEDGE_ENTRIES {
    uuid id PK
    uuid userId FK
    text content
    int knowledgePoints
  }
  ACQUIRED_SKILLS {
    uuid id PK
    uuid userId FK
    string title
    text description
    int points
  }
  ACHIEVEMENT_RECORDS {
    uuid id PK
    uuid userId FK
    string title
    int points
  }
  MONTHLY_REPORTS {
    uuid id PK
    uuid userId FK
    string periodKey
    json snapshotJson
  }
  POINT_EVENTS {
    uuid id PK
    uuid userId FK
    enum pointType
    enum sourceType
    int points
    string idempotencyKey UK
  }
```

### テーブル概要

| テーブル（Prismaモデル） | 主なフィールド | 制約・用途 |
|---|---|---|
| `users` (`User`) | `id`, `email`, `displayName`, `timezone`, `monthlyReportDay`, `monthlyReportTime`, `totalEp`, `createdAt`, `updatedAt` | `email` は一意。利用者情報と累計EP。 |
| `knowledge_entries` (`KnowledgeEntry`) | `id`, `userId`, `occurredAt`, `content`, `knowledgePoints`, `knowledgePointReason`, `createdAt`, `updatedAt`, `deletedAt` | フォームの年月・本文、KPと判定理由。利用者・発生日にindex。 |
| `acquired_skills` (`AcquiredSkill`) | `id`, `userId`, `title`, `description`, `confidentialityConfirmed`, `potentialImpact`, `perceivedCause`, `detectionTrigger`, `reuseIdea`, `impactLevel`, `status`, `categories`, `occurrenceScore`, `severityScore`, `detectabilityScore`, `rpn`, `riskLevel`, `points`, `reason`, `acquiredAt` | スキル登録フォームの各項目、SPと判定理由。利用者・取得日にindex。 |
| `achievement_records` (`AchievementRecord`) | `id`, `userId`, `title`, `points`, `reason`, `achievedAt`, `createdAt` | 実績、APと判定理由。利用者・達成日にindex。 |
| `monthly_reports` (`MonthlyReport`) | `id`, `userId`, `periodKey`, `periodStart`, `periodEnd`, `generatedAt`, `monthlyTitle`, `monthlyMessage`, `monthlyFocus`, `engineerTitle`, `engineerMessage`, `engineerNextAction`, `snapshotJson` | 月次評価と集計スナップショット。`userId` と `periodKey` の組み合わせは一意。 |
| `point_events` (`PointEvent`) | `id`, `userId`, `pointType`, `sourceType`, `knowledgeEntryId`, `acquiredSkillId`, `achievementRecordId`, `points`, `reason`, `idempotencyKey`, `createdAt` | ポイント加算履歴と参照元。`idempotencyKey` は一意で二重加算を防止。 |

主なenumは `ImpactLevel`（`none` / `minor` / `occurred`）、`KnowledgeStatus`（`considering` / `completed`）、`RiskLevel`（`low` / `medium` / `high` / `critical`）、`PointType`（`KP` / `SP` / `AP`）、`PointSourceType`（`knowledge` / `skill` / `achievement` / `quest`）です。

既存DBでは `knowledge_entries` の旧リスク・分類・対象列が削除されます。DB同期前に必要な旧データを退避し、バックアップを取得してください。

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

## ポイント評価基準

各登録を1件ずつ独立して評価し、0〜100の整数で1つの点数を付けます。他の登録内容や保有資格を加点に使わず、記載されていない能力・成果を推測しません。経験年数だけでは加点せず、技術的な難易度を重視します。個人開発も対象とし、記載が具体的でない場合は控えめに評価します。評価理由は簡潔に示します。

### ナレッジポイント（KP）

- 0〜20点: 基本用語や概要の理解
- 21〜40点: 基礎的な仕組みの理解
- 41〜60点: 専門的な知識や原理の理解
- 61〜80点: 高度な専門知識、複雑な設計知識
- 81〜100点: 非常に高度な専門知識、難関資格
- 資格取得は試験範囲、知識の深さ、問題の難易度を考慮
- 資格難易度の目安: Sランク85〜100点、Aランク70〜84点、Bランク50〜69点、Cランク30〜49点、Dランク10〜29点

### スキルポイント（SP）

- 0〜20点: 手順書に従った基本操作
- 21〜40点: 基本作業を一部自力で実施
- 41〜60点: 一般的な作業を自力で完遂
- 61〜80点: 高度な設計・構築・障害対応
- 81〜100点: 非常に高度な技術力、複雑な問題解決、技術指導

### 実績ポイント（AP）

- 0〜20点: 学習成果、簡単な制作物
- 21〜40点: 小規模な開発や改善実績
- 41〜60点: 業務システム開発、明確な成果
- 61〜80点: 高度なプロジェクト、大きな改善成果
- 81〜100点: 非常に高度な実績、組織やサービスへの大きな貢献

外部AIが利用できない場合や評価に失敗した場合も、登録1件の記載内容だけを使う控えめなfallback評価に切り替わります。

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
├── GitSecurityTool/            # GitSecurityTool submodule
│   └── GitSecurityTool/        # 検知スクリプトと設定
├── GitSecurityTool-keywords.example.yaml # 独自検知語設定のテンプレート
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
├── .gitmodules
├── .pre-commit-config.yaml
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

## GitSecurityTool（コミット前チェック）

[GitSecurityTool](https://github.com/tamina0624-study/GitSecurityTool) をGit submoduleとして組み込み、コミット前にgitleaks、基本ファイルチェック、独自の機密情報チェックを実行します。サブモジュールを含めて取得し、Python 3.11以上の環境でフックを設定してください。

新規にcloneする場合は `git clone --recurse-submodules <repository-url>` を使ってください。すでにclone済みの場合は次のコマンドでサブモジュールを取得します。

```bash
git submodule update --init --recursive
python -m pip install pre-commit
python -m pre_commit install
```

全ファイルを手動で検査する場合:

```bash
python -m pre_commit run --all-files
```

独自チェックの設定はGitSecurityTool側の `keywords.yaml` を読み込みます。初回はサンプルをコピーし、会社名・氏名・個人メール・秘密情報に関する語を必要に応じてローカルで追加してください。

```bash
cp GitSecurityTool-keywords.example.yaml GitSecurityTool/GitSecurityTool/keywords.yaml
```

`keywords.yaml` は個人・会社固有の情報を含むローカル専用ファイルです。GitSecurityToolサブモジュール内の `.git/info/exclude` に `GitSecurityTool/keywords.yaml` と `GitSecurityTool/.secret_detected.log` を追加し、設定値や検知ログをコミットしないでください。

## ビルド

```bash
npm run build
```

## Prisma 関連コマンド

```bash
npm run db:validate
npm run db:generate
npm run db:repair
npx prisma db push
```

既存データを保持したまま、旧DB構造との不整合（`acquired_skills.description` / `confidentialityConfirmed` 列の追加と、旧 `knowledge_entries.subject` / `summary` 列へのデフォルト値設定）を修復する場合は、`DATABASE_URL` が対象DBを指していることを確認してから次を実行します。このSQLは再実行可能で、既存レコードを削除しません。

```bash
npm run db:repair
```

アプリ起動時に同じ非破壊修復を自動適用するには、実行環境の環境変数に `REBUILD_DATABASE=1` を設定してください。Next.jsのNode.jsサーバー起動時に修復を行い、ビルド中とEdge Runtimeでは実行しません。この設定はテーブルを削除・再作成せず、データも削除しません。修復に失敗した場合は起動エラーとして表面化します。

テーブルを現行のPrismaスキーマから作り直す場合は、次のコマンドを実行します。この操作は接続先データベース内の既存データをすべて削除するため、事前に `DATABASE_URL` を確認し、必要なデータをバックアップしてください。スキーマ検証後に確認入力を求め、`REBUILD DATABASE` と入力した場合のみ再構築します。本番・CI環境では実行できません。

```bash
npm run db:rebuild
```

開発環境で自動実行する場合は、環境変数 `REBUILD_DATABASE=1` を設定します。この場合、対話確認を省略して再構築します。データを削除する操作であることを確認し、接続先を確認してから設定してください。本番・CI環境の実行禁止はこの設定でも変わりません。

```bash
REBUILD_DATABASE=1 npm run db:rebuild
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
