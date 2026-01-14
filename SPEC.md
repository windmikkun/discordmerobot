# Discord ポイントシステム 仕様書（v1）

この仕様書（SPEC.md）は本プロジェクトの唯一の仕様（Source of Truth）とする。
要件/設計/実装/テストは本仕様に従う。

---

## 1. 目的

Discordサーバー上で、ユーザー同士が複数種類の「ポイント」を付与できるBotを提供する。
v1では「メロポイント」を実装し、将来ポイント種を追加しやすい設計とする。

---

## 2. 用語

- **ギルド（Guild）**: Discordサーバー
- **ユーザー（User）**: Discordのアカウント（user_idで識別）
- **ポイント種（Point Type）**: 例: `mero`（将来追加可能）
- **付与（Give）**: 送信者が受信者にポイントを加算する行為
- **送信者（Giver）**: 付与を実行するユーザー
- **受信者（Receiver）**: ポイントを受け取るユーザー
- **日次**: JST（UTC+9）基準の 00:00〜23:59

---

## 3. スコープ

### 3.1 v1でやること
- ポイント付与（/give）
- 残高確認（/points）
- ランキング表示（/leaderboard）
- 永続化（SQLite）
- 日次送信回数制限（送信者×ポイント種×日付）

### 3.2 v1でやらないこと
- ポイント消費（減算）
- 複雑な権限管理（管理者UI等）
- Web管理画面
- 高度な監査/改ざん防止

---

## 4. ポイント種

### 4.1 メロポイント
- key: `mero`
- 表示名: メロポイント
- 付与単位: 1回あたり 1〜100 pt（送信時に指定）
- 消費: なし（付与のみ）
- 日次送信回数上限: `daily_limit_count`（設定値）

---

## 5. コマンド仕様

本Botはスラッシュコマンドで操作する。

### 5.1 /give
#### 目的
指定したポイント種を、指定ユーザーに指定量付与する。

#### 引数
- `type` (string, 必須): ポイント種キー（v1は `mero`）
- `to` (User, 必須): 受信者
- `amount` (number, 必須): 1〜100
- `message` (string, 必須): 理由（最大200文字）

#### バリデーション
- amount は `1 <= amount <= 100`
- message は 1文字以上、200文字以下
- 自分自身への付与は禁止
- Botアカウントへの付与は禁止
- 受信者がギルドに存在しない場合はエラー

#### 制限（送信回数制限）
- 日次送信回数制限を適用する（JST）
- 判定単位: `(guild_id, giver_user_id, type_key, date(JST))`
- その日の送信回数が `daily_limit_count` 以上の場合はエラー
- 制限超過時は **残高更新・ログ保存を一切行わない**

#### 成功時の処理
- 受信者の残高を `+amount` する
- 取引ログ（point_transactions）を保存する
- 実行チャンネルへ結果を投稿する

#### 成功時メッセージ例（参考）
- 💖 メロポイント付与！
- @giver → @receiver
- +50 メロポイント
- 「今日の発言がメロすぎた」

#### 失敗時メッセージ（参考）
- 回数上限: 「本日の送信回数上限に達しています」
- amount範囲外: 「amountは1〜100で指定してください」
- self/bot宛: 「そのユーザーには送れません」
- message不正: 「messageは200文字以内で入力してください」

---

### 5.2 /points
#### 目的
指定ユーザーの残高を表示する。

#### 引数
- `user` (User, 任意): 指定なしの場合は自分
- `type` (string, 任意): 指定なしの場合は全ポイント種

#### 出力
- type指定あり: そのポイント残高
- type指定なし: 全ポイント種の残高一覧

---

### 5.3 /leaderboard
#### 目的
指定ポイント種のランキング（上位10）を表示する。

#### 引数
- `type` (string, 必須): ポイント種キー（v1は `mero`）

#### 集計
- ギルド内の `user_points.balance` を対象に降順で上位10を表示する

---

## 6. 永続化（SQLite）

### 6.1 テーブル
#### point_types
- `key` TEXT PRIMARY KEY
- `name` TEXT NOT NULL
- `daily_limit_count` INTEGER NOT NULL
- `is_enabled` INTEGER NOT NULL (0/1)

#### user_points
- `guild_id` TEXT NOT NULL
- `user_id` TEXT NOT NULL
- `type_key` TEXT NOT NULL
- `balance` INTEGER NOT NULL
- PRIMARY KEY (`guild_id`, `user_id`, `type_key`)

#### point_transactions
- `id` TEXT PRIMARY KEY（uuid）
- `guild_id` TEXT NOT NULL
- `type_key` TEXT NOT NULL
- `giver_user_id` TEXT NOT NULL
- `receiver_user_id` TEXT NOT NULL
- `amount` INTEGER NOT NULL
- `message` TEXT NOT NULL
- `created_at` TEXT NOT NULL（ISO8601）

### 6.2 初期データ
- 起動時に `point_types` に `mero` が存在しない場合は作成する
  - name: メロポイント
  - daily_limit_count: 10（仮。変更可能）
  - is_enabled: 1

---

## 7. 日次判定（JST）

- 日次制限は JST 基準で判定する
- その日の範囲は `JST 00:00` から `翌日 JST 00:00` まで
- 実装では「今日のJST開始/終了」をISO文字列で求め、取引ログをカウントする

---

## 8. 受け入れ基準（Acceptance Criteria）

- /give により受信者の残高が増える
- 自分宛/ボット宛/amount範囲外/message不正で失敗する
- 日次送信回数上限を超えると失敗し、残高は増えない
- /points で残高確認できる
- /leaderboard で上位10が表示される
- Bot再起動後もデータが保持される（SQLite）

---

## 9. 将来拡張（指針）

- ポイント種追加は `point_types` に行を追加することで可能にする
- /give は `type` を受け取れる設計にしておく（v1では meroのみ有効でもよい）

----------------------------------------------------------------------------------------------------------------
# SPEC: Rules Agreement (Member Role Assignment) for Mero Bot

## 1. 概要
既存の Mero Bot に「ルール同意（ボタン）」機能を追加する。
新規参加者は Member ロールが無い状態で参加し、#rules を読んだあと #agree の同意ボタンを押すと Bot が Member ロールを付与する。
既存メンバー（すでに Member ロールを持つユーザー）は追加操作不要。

## 2. ゴール
- 新規参加者に Member ロールを自動付与できる
- 既存メンバーは何もしなくて良い
- Bot 停止/再起動に強い（ボタンは永続的に動作する）
- Admin が /setup で同意メッセージを1回で設置できる

## 3. 非ゴール
- CAPTCHA、外部認証、電話番号認証など高度なスパム対策は対象外
- ルール文言の自動生成は対象外（運営が自由に編集できるようにする）
- 複数サーバー対応は必須ではない（必要なら後で拡張）

## 4. 権限設計（前提）
- @everyone: ルール閲覧と同意チャンネル閲覧のみ（送信不可）
- Member: 通常チャンネル閲覧/送信可（#agree は見えない想定）
- Admin: 全権限

Bot 側の前提:
- Bot のロールは「Member ロールより上」に配置されていること
- Bot に「ロール管理」権限があること（Member付与のため）
- Bot は管理者権限を持たない（原則）

## 5. ユースケース

### UC-1 新規参加 → ルール同意
1) ユーザーがサーバー参加（Member無し）
2) ユーザーは #rules を閲覧
3) ユーザーは #agree で「同意する」ボタンを押す
4) Bot が Member ロールを付与
5) Bot が ephemeral で「同意ありがとう。Memberを付与しました。」と返す
6) 以後、通常チャンネルにアクセス可能になる

### UC-2 既存メンバーがボタンを押した場合
- 既に Member ロールを持っていたら何もしない（または「すでに同意済みです」と返す）

### UC-3 設定ミス（Memberロールが見つからない / Botが付与できない）
- Bot は ephemeral でエラーを通知し、ログにも記録する

## 6. UI/メッセージ仕様

### #agree に設置するメッセージ（Embed + Button）
Embed:
- タイトル: 「📜 サーバールールへの同意」
- 説明:
  - 「#rules を確認のうえ、下のボタンで同意してください」
  - 「同意後、自動的に Member ロールが付与されます」

Button:
- ラベル: 「✅ 同意する」
- customId: `rules_agree`

（任意）
- 2回目以降押せないようにする必要はない（Memberは#agreeを見えなくしておく想定）

## 7. Slash Command 仕様（Adminのみ）

### /setup-rules-agree
目的:
- #agree に同意メッセージ（Embed + Button）を投稿する

オプション:
- channel (任意): 投稿先チャンネルID指定。未指定なら ENV の AGREE_CHANNEL_ID を使用。

期待動作:
- 既に設置済みでも実行可能（再設置可）
- 実行結果を ephemeral で返す（「設置しました」）

権限:
- Admin ロールのみ実行可（または Discord の Administrator / ManageGuild を条件に）

## 8. 設定（環境変数）
必須:
- DISCORD_TOKEN
- GUILD_ID（ギルド限定コマンド登録用。既存Botで既にあるなら流用）
- MEMBER_ROLE_ID（付与する Member ロールID）
- AGREE_CHANNEL_ID（同意ボタンを設置するチャンネルID）

任意:
- RULES_CHANNEL_ID（#rulesへの導線を出すための表示用）
- LOG_CHANNEL_ID（運営ログを流したい場合）

## 9. 実装要件（Discord.js v14想定）
- InteractionCreate イベントで ButtonInteraction を処理
- `customId === "rules_agree"` のとき Member ロールを付与
- Member付与前に以下をチェック:
  - 対象が guild 内メンバーである
  - MEMBER_ROLE_ID が存在する
  - Bot がロール付与できる（role position / permissions）
- ロール付与後は ephemeral で成功メッセージ
- 既にロールを持っている場合は ephemeral で「すでに付与済み」
- 例外は握りつぶさずログ出力

## 10. データ保存
必須ではない（Discordのロールが状態となるため）。
ただし運営上の監査目的で保存したい場合のみ、SQLite に下記テーブルを追加してもよい。

### (任意) テーブル: rules_agreements
- id: integer (pk)
- guild_id: text
- user_id: text
- agreed_at: datetime (ISO)

※この保存は「付与成功時のみ」insert。

## 11. テスト観点（手動）
- 新規アカウントで参加（Memberなし）
  - #rules と #agree は見える
  - 通常チャンネルは見えない
  - ボタン押下 → Member付与 → 通常チャンネルが見える
- 既存メンバーでボタン押下
  - すでに付与済みと返る
- MEMBER_ROLE_ID を間違えたとき
  - エラーがephemeralで返る
- Botロールが Member より下のとき
  - 付与できずエラーが返る（運用で気づける）

## 12. 実装タスク（Windsurf向け）
1) ENV 追加: MEMBER_ROLE_ID / AGREE_CHANNEL_ID
2) スラッシュコマンド追加: /setup-rules-agree (admin only)
3) ボタン処理追加: customId `rules_agree`
4) (任意) DB: rules_agreements テーブル追加 + insert
5) README にセットアップ手順追記（ロール位置/権限の注意含む）
