# Implementation Tasks

## 記述ルール（必須）
- 1タスク = 1コミット（または1PR）想定
- 上から順に実装すれば動く状態になる並びにする
- 各タスクに「目的」「作業内容」「完了条件」を書く
- 各タスクに対応する SPEC.md / design.md の参照を明記する
- 実装が失敗してもロールバックしやすい粒度にする

---

## Task 1: プロジェクト初期化

### 目的
Discord Bot 実装の土台を作る

### 作業内容
- Node.js / TypeScript プロジェクト初期化
- package.json 作成
- tsconfig.json 作成
- dotenv 導入

### 完了条件
- `npm run dev` が実行できる
- TypeScript がコンパイルできる

### 参照
- design.md §2

---

## Task 2: Discord Client 起動

### 目的
Bot が起動し、Discord に接続できる状態にする

### 作業内容
- discord.js v14 導入
- Client 作成
- interactionCreate の受信確認
- 起動ログ出力

### 完了条件
- Bot がオンライン表示になる
- interaction を受信してログが出る

### 参照
- design.md §1

---

## Task 3: スラッシュコマンド登録

### 目的
Discord にコマンドを登録できるようにする

### 作業内容
- scripts/deploy-commands.ts 作成
- /give /points /leaderboard の定義作成
- GUILD_ID があればギルド登録、なければグローバル登録

### 完了条件
- Discord 上でコマンドが表示される

### 参照
- design.md §2, §7

---

## Task 4: SQLite 初期化

### 目的
永続化の基盤を作る

### 作業内容
- better-sqlite3 導入
- src/infra/db.ts 作成
- CREATE TABLE IF NOT EXISTS 実装
- 初期 point_types（mero）挿入処理

### 完了条件
- SQLite ファイルが生成される
- テーブルが作成されている

### 参照
- design.md §3
- SPEC.md §6

---

## Task 5: PointsRepository 実装

### 目的
DBアクセスを集約する

### 作業内容
- PointsRepository.ts 作成
- 残高取得・更新
- 取引ログ保存
- 日次送信回数カウント

### 完了条件
- Repository 単体でCRUDが成立する

### 参照
- design.md §3

---

## Task 6: PointsService 実装

### 目的
仕様ロジックの中核を実装する

### 作業内容
- give(...) 実装
- バリデーション・制限チェック
- Repository 呼び出し

### 完了条件
- 仕様通りの成功/失敗判定ができる

### 参照
- design.md §4, §5
- SPEC.md §5.1, §7

---

## Task 7: /give コマンド実装

### 目的
ポイント付与を実際に使えるようにする

### 作業内容
- src/commands/give.ts 作成
- 入力取得
- Service 呼び出し
- 結果メッセージ生成

### 完了条件
- /give が成功・失敗する

### 参照
- design.md §7
- SPEC.md §5.1

---

## Task 8: /points コマンド実装

### 目的
残高確認機能を提供する

### 作業内容
- src/commands/points.ts 作成
- 単一/複数ポイント表示分岐

### 完了条件
- /points で正しい残高が表示される

### 参照
- design.md §7
- SPEC.md §5.2

---

## Task 9: /leaderboard コマンド実装

### 目的
ランキング表示機能を提供する

### 作業内容
- src/commands/leaderboard.ts 作成
- 上位10件取得
- 表示整形

### 完了条件
- 正しい順位が表示される

### 参照
- design.md §7
- SPEC.md §5.3

---

## Task 10: README 整備

### 目的
セットアップ手順を明確にする

### 作業内容
- README.md 作成
- 環境変数説明
- 起動手順記載

### 完了条件
- 初見でも Bot を起動できる

### 参照
- design.md 全体

---

## 最終確認
- 全タスクが順番通り実装されていれば、Bot が正常動作すること
- 各タスクは独立してレビュー可能であること