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

----------------------------------------------------------------------------------------------------------------
# SPEC: 配信ポイント（VC配信 / 視聴 / 投げ銭） for Mero Bot（v1.1）

## 1. 概要
VC（ボイスチャンネル）内で「配信している」「配信を視聴している」活動に応じてポイント（配信ポイント）を自動付与する。
さらに、視聴者が自分の保有する配信ポイントを“同じVCの配信者のみ”に投げ銭（送金）できる。

（可能なら）画面共有も配信として扱う。

---

## 2. 用語
- **配信者（Streamer）**: VCで配信状態（Go Live / 画面共有 / カメラ等、判定条件は後述）にあるユーザー
- **視聴者（Viewer）**: VCに参加していて、配信者ではないユーザー
- **配信ポイント（Stream Points）**: 本仕様で追加する新ポイント種（type_key: `stream`）
- **投げ銭（Tip）**: 視聴者が配信者に配信ポイントを送金する行為（送金元は減算、送金先は加算）

---

## 3. スコープ
### 3.1 v1.1でやること
- 自動付与（VC配信/視聴の滞在に応じた定期加算）
- 配信者 > 視聴者 の付与レート
- 投げ銭（同じVCの配信者のみへ送金）
- 既存 `/points` `/leaderboard` で `type:stream` を扱えるようにする（=ポイント種追加）

### 3.2 v1.1でやらないこと
- 外部配信サイト連携（Twitch/YouTube等の視聴判定）
- 通貨換算、課金、決済
- 複雑な不正対策（多重アカウント検知等）
- 投げ銭の取り消し/返金

---

## 4. ポイント種（追加）

### 4.2 配信ポイント
- key: `stream`
- 表示名: 配信ポイント
- 付与単位: 定期付与（分単位換算）
- 消費: **投げ銭でのみ減算が発生する**
- 日次送信回数上限:
  - 自動付与・投げ銭は `/give` の日次制限とは別系統とし、ここでは適用しない（後述のバリデーションを適用）

---

## 5. 自動付与仕様（VC滞在）

### 5.1 判定間隔
- `STREAM_POINT_TICK_SECONDS` 秒ごとに定期処理を実行する（例: 60秒）
- 1 tick で付与するポイント量は「1分相当」を基準に計算してよい（端数は切り捨て or tick=60固定推奨）

### 5.2 配信者判定
以下のいずれかを満たすユーザーを「配信者」とする（可能な範囲で実装）。
- VC内で “配信中” と判定できる状態（Go Live 等）
- （可能なら）画面共有も配信扱いに含める

※Discord.js側で取れるフラグに依存するため、実装上は「取れる情報で最大限」対応し、取れない場合は将来拡張（v1.2）に回す。

### 5.3 視聴者判定
- VCに参加している（bot除外）
- 配信者ではない

### 5.4 付与レート（配信者 > 視聴者）
- 視聴者: `STREAM_VIEWER_POINT_PER_MIN` pt/分（例: 1）
- 配信者: `STREAM_STREAMER_POINT_PER_MIN` pt/分（例: 2）
- 同一tick内に複数配信者がいても、視聴者の付与レートは変えない（追加仕様が必要ならv1.2）

### 5.5 付与条件（最低限）
- VCに **人間ユーザーが2人以上**いる場合のみ付与する（ソロ放置対策）
  - `STREAM_MIN_HUMANS_IN_VC`（例: 2）
- botアカウントは付与対象外

（任意・v1.2候補）
- deafened の場合は視聴者ポイントなし 等

### 5.6 付与ログ
- 付与のたびに `point_transactions` に記録する（監査・ランキング整合のため）
- 自動付与の giver_user_id は特別値 `SYSTEM` を使用する
  - giver_user_id: `SYSTEM`
  - receiver_user_id: 対象ユーザー
  - type_key: `stream`
  - amount: tickで付与されたpt
  - message: 例）`"VC視聴ボーナス"` / `"VC配信ボーナス"`
  - created_at: ISO8601

---

## 6. 投げ銭（送金）仕様

### 6.1 新コマンド: /tip
#### 目的
自分の配信ポイント（stream）を、同じVCにいる“配信者”に送る。

#### 引数
- `to` (User, 必須): 送金先（配信者）
- `amount` (number, 必須): 1〜10000（上限は設定値でも可）
- `message` (string, 任意): 0〜200文字（任意。未指定は空でよい）

#### バリデーション
- amount は `1 <= amount <= STREAM_TIP_MAX_AMOUNT`
- 送金元（実行者）は bot でない
- `to` は bot でない
- 自分自身への投げ銭は禁止
- 送金元の `stream` 残高が `amount` 以上であること（不足はエラー）
- 送金先は **実行時点で同じVCに参加している配信者であること**
  - 同じVCでない → エラー
  - 同じVCだが配信者判定でない → エラー
- 送金はギルド内のみ（guild_idで整合）

#### 成功時の処理（原子的に）
- 送金元の `stream` 残高を `-amount`
- 送金先の `stream` 残高を `+amount`
- `point_transactions` に記録する（投げ銭ログ）
  - giver_user_id: 送金元ユーザー
  - receiver_user_id: 送金先ユーザー
  - type_key: `stream`
  - amount: amount
  - message: 例）`"TIP: ありがとう！"`（任意メッセージがあれば含める）
  - created_at: ISO8601
- 実行チャンネルへ結果を投稿（ephemeralでも可だが、v1.1は公開投稿推奨）

#### 成功時メッセージ例（参考）
- 🎁 投げ銭しました！
- @giver → @streamer
- -100 配信ポイント（送金）
- 「いつも配信ありがとう！」

#### 失敗時メッセージ（参考）
- 残高不足: 「配信ポイントが足りません」
- 同じVCではない: 「投げ銭は同じVCの配信者にのみ送れます」
- 配信者ではない: 「送金先は“配信中のユーザー”のみ指定できます」
- amount不正: 「amountは1〜{MAX}で指定してください」
- 自分宛/ボット宛: 「そのユーザーには送れません」

---

## 7. 永続化（SQLite）追加/変更

### 7.1 point_types 初期データ追加
- 起動時に `point_types` に `stream` が存在しない場合は作成する
  - name: 配信ポイント
  - daily_limit_count: 0（本仕様では未使用。0固定でよい）
  - is_enabled: 1

### 7.2 既存テーブルのまま運用
- `user_points` を `type_key=stream` で利用する
- `point_transactions` を自動付与/投げ銭のログにも利用する

---

## 8. 設定（環境変数）追加

必須（推奨）:
- STREAM_POINT_TICK_SECONDS（例: 60）
- STREAM_VIEWER_POINT_PER_MIN（例: 1）
- STREAM_STREAMER_POINT_PER_MIN（例: 2）
- STREAM_MIN_HUMANS_IN_VC（例: 2）
- STREAM_TIP_MAX_AMOUNT（例: 10000）

任意:
- STREAM_ENABLED（0/1、デフォルト1）

---

## 9. 受け入れ基準（Acceptance Criteria）

- VCに人間が2人以上いる状態で、視聴者に配信ポイントが定期的に加算される
- 同条件で、配信者は視聴者より多いレートで加算される
- /points type:stream で残高確認できる
- /leaderboard type:stream でランキングが表示できる
- /tip により送金元は減算され、送金先は加算される
- /tip は「同じVCの配信者」のみに送れる（それ以外は必ず失敗する）
- Bot再起動後も配信ポイントの残高と履歴が保持される（SQLite）

---

## 10. 実装タスク（Windsurf向け）
1) DB初期データに `stream` を追加（point_types）
2) VC定期処理（tick）を追加
   - VC参加者一覧取得 → 配信者/視聴者判定 → 付与 → user_points更新 → point_transactions記録
3) `/tip` コマンド追加（streamのみ）
   - 同VC配信者チェック + 残高チェック + 原子的更新（可能ならトランザクション）
4) 既存 `/points` `/leaderboard` が `type:stream` を扱えることを確認
5) README更新（配信ポイントの仕組み・ENV・使い方）
