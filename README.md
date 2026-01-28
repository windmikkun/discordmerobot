# Discord Mero Points Bot

Discordサーバー内でポイントを付与・確認・ランキング表示できるボットです。  
v1では「メロポイント」に対応しています。

## 📋 プロジェクト概要

このBotは以下の機能を提供します：

- **ポイント付与**: `/give` - 他ユーザーにポイントを送信
- **残高確認**: `/points` - 自分や他ユーザーのポイント残高を確認
- **ランキング表示**: `/leaderboard` - サーバー内のポイントランキングを表示
- **ルール同意**: `/setup-rules-agree` - 新規参加者のMemberロール自動付与
- **配信ポイント**: VC配信・視聴で自動的にポイント付与
- **投げ銭**: `/tip` - 配信者に配信ポイントを投げ銭

v1では「メロポイント」のみ対応しています。将来の拡張で複数のポイント種に対応する予定です。

## 📦 必要要件

- **Node.js**: 22.x 以上を推奨
- **npm**: Node.jsに同梱
- **OS**: Windows / macOS 両対応（Windowsで動作確認済み）

Windowsでの安定動作：Visual Studio Build Toolsは不要です。sqlite3 + sqliteドライバを使用しているため、ネイティブモジュールのビルド問題を回避しています。

## 🚀 セットアップ手順

1. **リポジトリをクローン**
   ```bash
   git clone <repository-url>
   cd discordmerobot
   ```

2. **依存パッケージをインストール**
   ```bash
   npm install
   ```

3. **環境変数ファイルを作成**
   ```bash
   copy .env.example .env
   ```

4. **.envファイルを編集**（後述の環境変数説明を参照）

## ⚙️ 環境変数

| 変数名 | 必須 | 説明 | 例 |
|--------|------|------|-----|
| `DISCORD_TOKEN` | ✅ | Discord Botのトークン | `MTIzNDU2Nzg5...` |
| `CLIENT_ID` | ✅ | DiscordアプリケーションのクライアントID | `123456789012345678` |
| `GUILD_ID` | ❌ | 開発用サーバーID（指定すると即反映） | `987654321098765432` |
| `DATABASE_PATH` | ❌ | SQLiteデータベースファイルのパス | `./data/bot.sqlite` |
| `MEMBER_ROLE_ID` | ✅ | ルール同意時に付与するMemberロールID | `123456789012345678` |
| `AGREE_CHANNEL_ID` | ✅ | 同意ボタンを設置するチャンネルID | `987654321098765432` |
| `STREAM_ENABLED` | ❌ | 配信ポイント機能を有効化（true/false） | `true` |
| `STREAM_POINT_TICK_SECONDS` | ❌ | ポイント付与間隔（秒） | `60` |
| `STREAM_VIEWER_POINT_PER_MIN` | ❌ | 視聴者への1分あたりポイント | `1` |
| `STREAM_STREAMER_POINT_PER_MIN` | ❌ | 配信者への1分あたりポイント | `2` |
| `STREAM_MIN_HUMANS_IN_VC` | ❌ | ポイント付与の最小人数 | `2` |
| `STREAM_TIP_MAX_AMOUNT` | ❌ | 投げ銭の最大額 | `1000` |
| `LOG_LEVEL` | ❌ | ログレベル（debug/info/warn/error） | `info` |

### Discordトークンの取得方法

1. [Discord Developer Portal](https://discord.com/developers/applications) にアクセス
2. 「New Application」を作成
3. 「Bot」セクションでBotを作成し、トークンをコピー
4. 「OAuth2」→「URL Generator」で `bot` と `applications.commands` を選択
5. 生成されたURLでサーバーにBotを招待

## 📋 コマンド登録

Botをサーバーで使用する前に、スラッシュコマンドを登録する必要があります。

```bash
npm run deploy:commands
```

- `GUILD_ID` を指定している場合：即座に反映されます（開発用）
- `GUILD_ID` を未指定の場合：全世界反映まで最大1時間かかります

## 🎮 起動方法

```bash
npm run dev
```

起動時に以下が自動的に行われます：

- SQLiteデータベースの初期化（`./data/bot.sqlite`）
- ポイント種の初期データ投入
- Discordへのログイン

## 💬 Discordコマンドの使い方

### `/give` - ポイント付与
他ユーザーにポイントを付与します。成功メッセージはチャンネル全体に表示されます。

```bash
/give type:mero to:@user amount:50 message:"ありがとう！"
```

- `type`: ポイント種（v1ではmeroのみ）
- `to`: 付与先ユーザー
- `amount`: 付与量（1〜100）
- `message`: 理由（1〜200文字）

### `/points` - 残高確認
ポイント残高を確認します。結果は自分にのみ表示されます（ephemeral）。

```bash
/points                    # 自分の全ポイント
/points user:@someone      # 特定ユーザーの残高
/points type:mero          # meroポイントのみ
```

### `/leaderboard` - ランキング表示
サーバー内のポイントランキングを表示します。結果はチャンネル全体に表示されます。

```bash
/leaderboard               # デフォルト（mero/10件）
/leaderboard type:mero limit:5  # meroポイント上位5件
/leaderboard type:stream limit:10  # 配信ポイント上位10件
```

### `/tip` - 投げ銭
配信中のユーザーに配信ポイントを投げ銭します。

```bash
/tip to:@streamer amount:100 message:"面白い配信です！"
```

- `to`: 投げ銭先ユーザー（必須）
- `amount`: 投げ銭額（1〜STREAM_TIP_MAX_AMOUNT）
- `message`: メッセージ（任意）

**投げ銭条件**:
- 同じボイスチャンネルにいる必要がある
- 投げ銭先が配信中である必要がある
- 自分自身やBotには投げ銭できない
- 配信ポイントの残高が必要

## 📋 配信ポイント機能

### 🎯 機能概要
VCでの配信活動を自動的に検出し、配信者と視聴者にポイントを付与する機能です。

### 🔄 自動付与条件
- VCに2人以上の人間ユーザーがいる
- 配信者がstreaming状態になっている
- STREAM_ENABLEDがtrueに設定されている

### 📊 ポイント付与量
- **配信者**: STREAM_STREAMER_POINT_PER_MIN（デフォルト: 2/分）
- **視聴者**: STREAM_VIEWER_POINT_PER_MIN（デフォルト: 1/分）

### ⚙️ 必要な設定
- **Bot権限**: 
  - GuildVoiceStates（配信状態検出）
  - GuildMembers（VCメンバー検出）
- **環境変数**: STREAM関連の変数を全て設定

### 🎮 使い方
1. VCで配信を開始（DiscordのGo Live機能）
2. 視聴者がVCに参加
3. 自動的にポイントが付与される
4. `/points type:stream` で残高確認
5. `/tip` で配信者に投げ銭

### `/setup-rules-agree` - ルール同意設定（管理者のみ）
ルール同意メッセージを設置します。

```bash
/setup-rules-agree channel:#agree
```

- `channel`: 設置先チャンネル（未指定ならAGREE_CHANNEL_IDを使用）

## 📋 ルール同意機能

### 🎯 機能概要
新規参加者がルールに同意すると自動的にMemberロールを付与する機能です。

### 🔄 利用フロー
1. 管理者が `/setup-rules-agree` で同意メッセージを設置
2. 新規参加者が「✅ 同意する」ボタンをクリック
3. BotがMemberロールを自動付与
4. 参加者は通常チャンネルにアクセス可能に

### ⚙️ 必要な設定
- **Bot権限**: ロール管理権限が必要
- **ロール位置**: BotのロールがMemberロールより上にあること
- **チャンネル設定**: 
  - @everyone: #rulesと#agreeのみ閲覧可能
  - Member: 通常チャンネル閲覧・送信可能（#agreeは非表示）

### 🚨 注意点
- Botに管理者権限は不要ですが、ロール管理権限は必須です
- MEMBER_ROLE_IDとAGREE_CHANNEL_IDの正確な設定が必要です
- 既にMemberロールを持つユーザーがボタンを押しても何も起こりません

## 📝 仕様メモ（v1）

### ポイント付与ルール
- **付与量**: 1〜100ポイント
- **メッセージ**: 1〜200文字
- **日次制限**: JST基準で1日10回まで
- **禁止事項**: 
  - 自分自身への付与
  - Botへの付与

### データ管理
- データベースはSQLiteでローカルに保存
- 起動時に自動でDBファイルとテーブルが作成されます
- 初期状態では「mero」ポイント種が登録されています

## 🔧 トラブルシュート

### npm installが失敗する場合
```bash
# node_modulesを削除して再インストール
rmdir /s node_modules
npm install
```

### PowerShellで&&が使えない場合
PowerShellでは `&&` が使えないため、コマンドを分けて実行してください：

```powershell
npm run build
npm run dev
```

### コマンドが表示されない場合
1. Botがサーバーに招待されているか確認
2. `npm run deploy:commands` を実行済みか確認
3. `GUILD_ID` を指定して即反映を試す
4. Discordアプリを再起動する

### Botが起動しない場合
1. `.env` ファイルが正しく設定されているか確認
2. `DISCORD_TOKEN` が有効か確認
3. Botに必要な権限（`bot`, `applications.commands`）があるか確認

## 📚 ドキュメント

- **[設計ドキュメント](docs/design.md)** - アーキテクチャと技術的な設計
- **[タスクリスト](docs/tasks.md)** - 開発タスクの進捗と詳細

## 📄 ライセンス

（必要に応じてライセンスを記載）

---

💡 **ヒント**: 開発時は `GUILD_ID` を指定するとコマンドが即反映されて便利です。本番環境向けでは `GUILD_ID` を削除して全世界反映を待ってください。
