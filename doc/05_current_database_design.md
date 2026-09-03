# Safety Quest 現行DB設計

## 1. 目的

現行アプリの `ナレッジ登録`、`獲得スキル`、`実績登録`、`一覧検索`、`ダッシュボード`、`月次レポート` に対応するDB構造を定義する。

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

ナレッジ登録画面の内容を保存する。

| カラム | 型 | 制約・説明 |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK users, index |
| `occurred_at` | timestamptz | 発生日時、index |
| `subject` | varchar(200) | ナレッジの対象 |
| `content` | text | 気づき・学びの内容 |
| `potential_impact` | text | 想定される影響 |
| `perceived_cause` | text | 原因の自己認識 |
| `detection_trigger` | text | 発見契機 |
| `reuse_idea` | text | 次に活かす工夫 |
| `impact_level` | enum | `none/minor/occurred` |
| `status` | enum | `considering/completed` |
| `categories` | text[] | 分類 |
| `occurrence_score` | smallint | リスク目安用、1〜5 |
| `severity_score` | smallint | リスク目安用、1〜5 |
| `detectability_score` | smallint | リスク目安用、1〜5 |
| `rpn` | smallint | リスク目安 |
| `risk_level` | enum | `low/medium/high/critical` |
| `summary` | text | 一覧表示用の通常要約 |
| `knowledge_points` | integer | KP |
| `knowledge_point_reason` | text | AI判定理由 |
| `created_at` | timestamptz | not null |
| `updated_at` | timestamptz | not null |
| `deleted_at` | timestamptz | 論理削除 |

主なインデックス:

- `user_id, occurred_at desc`
- `user_id, status`

## 6. acquired_skills

獲得スキル画面で登録した内容を保存する。

| カラム | 型 | 制約・説明 |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK users, index |
| `title` | text | 身についたスキル |
| `points` | integer | SP |
| `reason` | text | AI判定理由 |
| `acquired_at` | timestamptz | 登録日時 |
| `created_at` | timestamptz | not null |

主なインデックス:

- `user_id, acquired_at desc`

## 7. achievement_records

実績登録画面で登録した内容を保存する。

| カラム | 型 | 制約・説明 |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK users, index |
| `title` | text | 達成した実績 |
| `points` | integer | AP |
| `reason` | text | AI判定理由 |
| `achieved_at` | timestamptz | 登録日時 |
| `created_at` | timestamptz | not null |

主なインデックス:

- `user_id, achieved_at desc`

## 8. monthly_reports

レポート画面で作成した月次評価を保存する。

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
| ナレッジ登録 | `knowledge_entries`, `point_events` | KP判定後に登録 |
| 獲得スキル | `acquired_skills`, `point_events` | SP判定後に登録 |
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
