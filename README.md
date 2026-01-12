# Discord Mero Points Bot

Discordサーバー内でポイントを付与・確認・ランキング表示できるボットです。  
v1では「メロポイント」に対応しています。

## 📋 プロジェクト概要

このBotは以下の機能を提供します：

- **ポイント付与**: `/give` - 他ユーザーにポイントを送信
- **残高確認**: `/points` - 自分や他ユーザーのポイント残高を確認
- **ランキング表示**: `/leaderboard` - サーバー内のポイントランキングを表示

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
```

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
