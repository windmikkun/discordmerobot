# Design Document

## 1. 全体アーキテクチャ

### Discord Bot の処理フロー概要
interaction 受信 → command → domain → infra → 応答 のフローで処理する（SPEC.md §5参照）。

### 責務分離の方針
- **commands**: 入出力のみ。Discord interaction の受信と応答メッセージ生成
- **domain**: 仕様ロジック（制限・検証・付与）。ビジネスルールの実装
- **infra**: SQLite 永続化。データアクセスとトランザクション管理

### SPEC.md §9（将来拡張）との対応
ポイント種追加は `point_types` テーブルへの行追加で対応可能。domain層の抽象化により、新ポイント種の追加は設定変更のみで対応可能にする。

---

## 2. ディレクトリ / ファイル構成

以下の構成を採用する理由：責務分離を明確にし、テスト容易性と将来拡張性を確保するため。

- **src/index.ts**: Bot起動とイベントハンドラ登録
- **src/commands/**
  - **give.ts**: /give コマンドの入出力処理
  - **points.ts**: /points コマンドの入出力処理  
  - **leaderboard.ts**: /leaderboard コマンドの入出力処理
- **src/domain/**
  - **PointsService.ts**: ポイント付与・確認のビジネスロジック（SPEC.md §5.1）
  - **errors.ts**: ドメインエラー定義
- **src/infra/**
  - **db.ts**: SQLite接続とマイグレーション（SPEC.md §6）
  - **PointsRepository.ts**: ポイント関連のデータアクセス
- **src/utils/**
  - **jstDate.ts**: JST日付処理（SPEC.md §7）
- **scripts/deploy-commands.ts**: Discordスラッシュコマンド登録

---

## 3. データ設計（SQLite）

### 使用DB: SQLite（sqlite3 + sqlite）
本実装では Windows 環境での安定性を優先し、SQLite ドライバとして sqlite3 + sqlite を採用する。そのため DB 初期化および Repository 操作は async/await を前提とする。
個人運用のBotとして、セットアップ不要・堅牢性・トランザクションサポートを考慮（SPEC.md §6参照）。

### テーブル構成
- **point_types**: ポイント種定義（SPEC.md §6.1）
- **user_points**: ユーザー残高（SPEC.md §6.1）
- **point_transactions**: 取引履歴（SPEC.md §6.1）

### 各テーブルの役割
- **point_types**: ポイント種のメタデータと制限値管理
- **user_points**: 各ユーザーの現在の残高を保持
- **point_transactions**: 全取引の監査証跡と日次制限判定用

### トランザクション整合性の考え方
`give` 処理は `user_points` 更新と `point_transactions` 追加を同一トランザクションで実行。制限超過時は一切のDB更新を行わない（SPEC.md §5.1）。

**v1実装方針**: トランザクションヘルパー未実装のため「ログ→残高」の順序で実行。途中で落ちた場合の不整合はv2でトランザクション化対応予定。

---

## 4. ドメイン設計（PointsService）

### give(...) の責務と処理順
1. **引数検証**: amount範囲、message長（SPEC.md §5.1）
2. **self/bot 宛チェック**: 禁止ユーザーへの付与防止（SPEC.md §5.1）
3. **ポイント種の有効性確認**: point_types.is_enabled チェック
4. **JST 日次送信回数制限チェック**: 当日の送信回数取得（SPEC.md §5.1, §7）
5. **残高加算**: user_points.balance 更新
6. **取引ログ保存**: point_transactions レコード追加

### 制限超過時のロールバック方針
制限チェックはDB更新前に実行。超過時は例外を投げ、commands層でキャッチしてエラーメッセージ応答。一切のDB更新を行わないことで整合性保証（SPEC.md §5.1）。

---

## 5. 日次制限の設計（JST）

### JST 基準の日付レンジ算出方法
`utils/jstDate.ts` で本日のJST開始時刻と終了時刻をISO文字列で算出。`new Date()` からJSTオフセット（+9時間）を適用。

### utils/jstDate.ts に切り出す理由
日付処理ロジックの集約とテスト容易性のため。JST基準というビジネスルールを1箇所に集中管理（SPEC.md §7）。

### 送信回数カウントのクエリ方針
`point_transactions` から `(guild_id, giver_user_id, type_key, created_at)` を条件に、対象日付範囲のレコード数をカウント。

---

## 6. エラー設計

### 想定エラー種別
- **ValidationError**: 入力値不正（amount範囲外、message長など）
- **DailyLimitExceededError**: 日次送信回数超過
- **PointTypeDisabledError**: 無効なポイント種

### errors.ts に集約する理由
ドメインロジックでのエラー型を一元管理し、commands層でのエラーハンドリングを統一するため。

### commands 層での扱い方（メッセージ化のみ）
domain層から例外を受け取り、Discordユーザー向けのエラーメッセージに変換して応答。エラー内容の詳細はログに出力。

---

## 7. コマンド設計

### /give
**入力 → Service 呼び出し → 出力の流れ**:
1. Discord interaction から引数を抽出
2. PointsService.give() を呼び出し
3. 成功: 結果メッセージを生成して応答
4. 失敗: エラーメッセージを生成して応答

**成功時メッセージ**: SPEC.md §5.1の例を参考に実装
**失敗時メッセージ**: エラー種別に応じた日本語メッセージを生成