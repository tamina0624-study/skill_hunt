# skill hant 現行DB設計

## 1. 目的

現行アプリの `獲得ナレッジ`、`スキル登録`、`実績登録`、`一覧検索`、`ダッシュボード`、`月次レポート` に対応するDB構造を定義する。

初期実装ではブラウザの `localStorage` に保存しているが、本設計はPostgreSQLへ移行するためのテーブル構造とする。

## 2. 方針

- 利用者ごとに全データを分離するため、業務データは `user_id` を持つ。
- ポイントは `KP`、`SP`、`AP` として扱い、合計値は `users.total_ep` に保持する。
- ポイント加算の根拠は `point_events` に保存し、二重加算を防ぐ。
- 月次レポートは `user_id + period_key` で1件にし、同じ月の再作成は上書きする。
- 画面の一覧検索では、ナレッジ、スキル、実績を横断検索する。
- 日時はDBではUTC保存、表示は利用者タイムゾーンで行う。

## 3. テーブル一覧

| テーブル | 用途 |
|---|---|
| `users` | 利用者、タイムゾーン、合計EP |
| `knowledge_entries` | ナレッジ登録内容、KP、KP判定理由 |
| `acquired_skills` | 獲得スキル、SP、SP判定理由 |
| `achievement_records` | 実績登録、AP、AP判定理由 |
| `monthly_reports` | 月次評価、エンジニア力評価 |
| `point_events` | KP/SP/APの加算履歴、冪等性管理 |

## 4. users

| カラム | 型 | 制約・説明 |
|---|---|---|
| `id` | uuid | PK |
| `email` | varchar(320) | unique, not null |
| `display_name` | varchar(100) | not null |
| `timezone` | varchar(64) | default `Asia/Tokyo` |
| `monthly_report_day` | smallint | default 1 |
| `monthly_report_time` | time | default `07:00` |
| `total_ep` | integer | default 0 |
| `created_at` | timestamptz | not null |
| `updated_at` | timestamptz | not null |

## 5. knowledge_entries

獲得ナレッジ画面で指定した年月・本文・KP評価を保存する。3種類のポイント記録は年月カラムを `recordedAt` に統一する。フォームにないリスク・分類・対象などの項目は持たない。

| カラム | 型 | 制約・説明 |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK users, index |
| `recordedAt` | timestamptz | フォームで指定した年月、index |
| `content` | text | ナレッジ本文 |
| `knowledge_points` | integer | KP |
| `knowledge_point_reason` | text | AI判定理由 |
| `created_at` | timestamptz | not null |
| `updated_at` | timestamptz | not null |
| `deleted_at` | timestamptz | 論理削除 |

主なインデックス:

- `user_id, recordedAt desc`

## 6. acquired_skills

スキル登録画面のフォーム内容、SP、SP判定理由を保存する。フォームの各項目は対応するカラムへ個別に保存し、タイトルへ連結しない。

| カラム | 型 | 制約・説明 |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK users, index |
| `title` | text | スキルの対象 |
| `description` | text | 気づき・学びの内容 |
| `confidentiality_confirmed` | boolean | 機密情報がないことの確認 |
| `potential_impact` | text | 想定される影響、nullable |
| `perceived_cause` | text | 原因の自己認識、nullable |
| `detection_trigger` | text | 発見契機、nullable |
| `reuse_idea` | text | 次に活かす工夫、nullable |
| `impact_level` | enum | 影響の有無 |
| `status` | enum | 検討中 / 完了 |
| `categories` | text[] | 内容から推定したカテゴリ |
| `occurrence_score` | smallint | 発生頻度評価、nullable |
| `severity_score` | smallint | 影響度評価、nullable |
| `detectability_score` | smallint | 検知性評価、nullable |
| `rpn` | smallint | リスク優先数、nullable |
| `risk_level` | enum | リスク目安、nullable |
| `points` | integer | SP |
| `reason` | text | AI判定理由 |
| `recordedAt` | timestamptz | フォームで指定した発生日時、index |
| `created_at` | timestamptz | not null |

主なインデックス:

- `user_id, recordedAt desc`

## 7. achievement_records

実績登録画面で登録した内容を保存する。

| カラム | 型 | 制約・説明 |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK users, index |
| `title` | text | 達成した実績 |
| `points` | integer | AP |
| `reason` | text | AI判定理由 |
| `recordedAt` | timestamptz | フォームで指定した年月、index |
| `created_at` | timestamptz | not null |

主なインデックス:

- `user_id, recordedAt desc`

## 8. monthly_reports

レポート画面で指定した年月の月次評価を保存する。3種類の記録テーブルから、`recordedAt` が日本時間の対象月に含まれるデータを集計する。

| カラム | 型 | 制約・説明 |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK users, index |
| `period_key` | varchar(7) | `YYYY-MM` |
| `period_start` | timestamptz | 対象月開始 |
| `period_end` | timestamptz | 対象月終了 |
| `generated_at` | timestamptz | 生成日時 |
| `monthly_title` | text | 月次評価タイトル |
| `monthly_message` | text | 月次評価本文 |
| `monthly_focus` | text | 次のステップ |
| `engineer_title` | text | エンジニア力評価タイトル |
| `engineer_message` | text | エンジニア力評価本文 |
| `engineer_next_action` | text | 次のステップ |
| `snapshot_json` | jsonb | 集計時点のKP/SP/AP内訳 |

制約:

- `user_id, period_key` を一意にする。

## 9. point_events

KP/SP/AP加算を履歴として保存する。

| カラム | 型 | 制約・説明 |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK users, index |
| `point_type` | enum | `KP/SP/AP` |
| `source_type` | enum | `knowledge/skill/achievement/quest` |
| `knowledge_entry_id` | uuid | 任意FK |
| `acquired_skill_id` | uuid | 任意FK |
| `achievement_record_id` | uuid | 任意FK |
| `points` | integer | 加算ポイント |
| `reason` | text | AI判定理由 |
| `idempotency_key` | varchar | unique |
| `created_at` | timestamptz | not null |

制約:

- `idempotency_key` を一意にして二重加算を防ぐ。

## 10. 画面との対応

| 画面 | 主テーブル | 補足 |
|---|---|---|
| ダッシュボード | `knowledge_entries`, `acquired_skills`, `achievement_records`, `monthly_reports`, `point_events` | 件数、EP、推移、最新レポートコメント |
| 獲得ナレッジ | `knowledge_entries`, `point_events` | KP判定後に登録 |
| スキル登録 | `acquired_skills`, `point_events` | SP判定後に登録 |
| 実績登録 | `achievement_records`, `point_events` | AP判定後に登録 |
| 一覧 | `knowledge_entries`, `acquired_skills`, `achievement_records` | 種別横断検索 |
| レポート | `monthly_reports` | 月次評価とエンジニア力評価を保存・表示 |
| 設定 | `users` | タイムゾーン、月次通知設定 |

## 11. Prisma schema

現行設計に対応するPrisma schemaは `prisma/schema.prisma` に定義する。

## 12. 関連フォルダ

| フォルダ | 役割 |
|---|---|
| `src/app` | Next.js App Routerの画面実装 |
| `prisma` | DB schemaと将来のマイグレーション |
| `doc` | 要件定義、基本設計、詳細設計、テスト仕様、DB設計 |
| `gui_mock` | 初期検討時の静的モック |

`node_modules` と `.next` は依存物・生成物のため、ソース管理や設計上のソースフォルダには含めない。
