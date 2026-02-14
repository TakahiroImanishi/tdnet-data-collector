---
name: "codex-cli"
displayName: "Codex CLI"
description: "OpenAIのコーディングエージェントCodexをターミナルから使用するための完全ガイド。インストール、設定、MCP連携、セキュリティ、自動化まで網羅。"
keywords: ["codex", "openai", "cli", "coding-agent", "terminal", "mcp", "automation"]
author: "OpenAI"
---

# Codex CLI

ターミナルでCodexと協働する

Codex CLIは、ターミナルからローカルで実行できるOpenAIのコーディングエージェントです。選択したディレクトリ内のコードを読み取り、変更し、実行できます。RustでビルドされているためSpeed and efficiencyに優れています。

CodexはChatGPT Plus、Pro、Business、Edu、Enterpriseプランに含まれています。

## オンボーディング

### 前提条件

- **OS**: macOS、Linux（Windows はWSL推奨）
- **Node.js**: 推奨バージョン 22以上（npmまたはnvm経由）
- **ChatGPTアカウント**: Plus、Pro、Business、Edu、またはEnterpriseプラン
  - または OpenAI APIキー

### インストール

#### npm経由

```bash
npm install -g @openai/codex
```

#### Homebrew経由（macOS）

```bash
brew install codex
```

#### WSL（Windows）での推奨セットアップ

Windowsユーザーは、WSL2を使用することを強く推奨します：

```powershell
# PowerShellで実行（管理者権限）
wsl --install

# WSLシェルに入る
wsl

# WSL内でNode.jsをインストール
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash

# 新しいタブで、またはWSLを再起動後
nvm install 22

# Codex CLIをインストール
npm i -g @openai/codex
```

### 初回起動と認証

```bash
codex
```

初回実行時、サインインを求められます：
- ChatGPTアカウントで認証
- またはOpenAI APIキーで認証

### インストール確認

```bash
# バージョン確認
codex --version

# ヘルプ表示
codex --help
```

### アップグレード

新しいバージョンは定期的にリリースされます。アップグレード方法：

```bash
# npm経由
npm i -g @openai/codex@latest

# Homebrew経由
brew upgrade codex
```

## 主要機能

### 1. 対話型ターミナルUI

`codex`コマンドで対話型セッションを開始：

```bash
cd ~/code/my-project
codex
```

**できること**:
- プロジェクトの検査
- ファイルの編集
- コマンドの実行
- コードレビュー
- デバッグとバグ修正

### 2. モデルとReasoningの制御

セッション中に`/model`コマンドでモデルを切り替え：

```
/model
```

- GPT-5.3-Codex
- その他の利用可能なモデル
- Reasoningレベルの調整

### 3. 画像入力

スクリーンショットやデザイン仕様を添付してCodexに読み取らせる：

```
# セッション中に画像をドラッグ&ドロップ
# またはファイルパスを指定
```

### 4. ローカルコードレビュー

コミットやプッシュ前に、別のCodexエージェントによるコードレビューを実行：

```bash
# コミット前のレビュー
codex review
```

### 5. Web検索

最新情報を取得してタスクに活用：

```bash
# Web検索を有効化
codex --search

# または設定ファイルで
# web_search = "live"
```

**注意**: デフォルトは`cached`モード（OpenAI管理のインデックス）。`live`モードは最新情報を取得しますが、プロンプトインジェクションのリスクがあります。

### 6. Codex Cloudタスク

ターミナルからCodex Cloudタスクを起動し、環境を選択して差分を適用：

```bash
codex cloud launch
```

### 7. スクリプト実行（自動化）

`exec`コマンドで繰り返しワークフローを自動化：

```bash
codex exec "プロジェクト内のすべてのTypeScriptファイルにESLintを実行して修正"
```

### 8. Model Context Protocol（MCP）連携

サードパーティツールやコンテキストへのアクセスを提供：

```bash
# MCPサーバーを追加
codex mcp add <server-name> -- <command>

# 例：Context7（開発者ドキュメント）
codex mcp add context7 -- npx -y @upstash/context7-mcp

# MCPサーバー一覧
codex mcp list

# MCPサーバー削除
codex mcp remove <server-name>
```

**設定ファイルで管理**:

`~/.codex/config.toml`を編集：

```toml
[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]

[mcp_servers.figma]
url = "https://mcp.figma.com/mcp"
bearer_token_env_var = "FIGMA_OAUTH_TOKEN"
```

**人気のMCPサーバー**:
- OpenAI Docs MCP
- Context7（開発者ドキュメント）
- Figma（デザインアクセス）
- Playwright（ブラウザ制御）
- Chrome Developer Tools
- Sentry（ログアクセス）
- GitHub（PR、Issue管理）

### 9. 承認モード

Codexが編集やコマンド実行前に承認を求めるレベルを選択：

```bash
# 自動モード（デフォルト）
codex --full-auto

# 読み取り専用
codex --sandbox read-only

# 承認なし（危険）
codex --dangerously-bypass-approvals-and-sandbox
# または
codex --yolo
```

## 一般的なワークフロー

### ワークフロー1: 新機能の実装

```bash
# プロジェクトディレクトリに移動
cd ~/code/my-app

# Gitブランチを作成
git checkout -b feature/new-feature

# Codexを起動
codex

# プロンプト例
> ユーザー認証機能を追加してください。JWTトークンを使用し、/api/loginと/api/registerエンドポイントを作成してください。
```

**Codexの動作**:
1. プロジェクト構造を分析
2. 必要なファイルを作成・編集
3. テストコードを生成（必要に応じて）
4. 変更内容を説明

**完了後**:
```bash
# 変更を確認
git diff

# コミット
git add .
git commit -m "feat: ユーザー認証機能を追加"
```

### ワークフロー2: バグ修正

```bash
cd ~/code/my-app
codex

> エラーログを確認して、ユーザーログイン時の500エラーを修正してください
```

**Codexの動作**:
1. ログファイルを読み取り
2. エラーの根本原因を特定
3. 修正を提案・適用
4. テストを実行して確認

### ワークフロー3: コードレビュー

```bash
# 変更をステージング
git add .

# Codexでレビュー
codex review

# または対話型セッション内で
> このPRをレビューして、潜在的なバグやエッジケースを指摘してください
```

### ワークフロー4: リファクタリング

```bash
codex

> src/utils/helper.tsをリファクタリングして、関数を小さく分割し、TypeScriptの型安全性を向上させてください
```

### ワークフロー5: テスト作成

```bash
codex

> src/services/auth.tsのユニットテストをJestで作成してください。エッジケースもカバーしてください。
```

### ワークフロー6: ドキュメント生成

```bash
codex

> このプロジェクトのREADME.mdを更新して、新しいAPI エンドポイントとその使用例を追加してください
```

## 高度な設定

### Rules（コマンド制御）

`.rules`ファイルでCodexが実行できるコマンドを制御：

```bash
# ルールファイルを作成
mkdir -p ~/.codex/rules
nano ~/.codex/rules/default.rules
```

**ルール例**:

```python
# gh pr viewコマンドを実行前に確認
prefix_rule(
    pattern = ["gh", "pr", "view"],
    decision = "prompt",
    justification = "PRの閲覧は承認が必要",
    match = [
        "gh pr view 7888",
        "gh pr view --repo openai/codex",
    ],
)

# rmコマンドを禁止
prefix_rule(
    pattern = ["rm"],
    decision = "forbidden",
    justification = "git clean -fd を使用してください",
)
```

**ルールのテスト**:

```bash
codex execpolicy check --pretty \
  --rules ~/.codex/rules/default.rules \
  -- gh pr view 7888
```

### Agent Skills

Codexに新しい機能や専門知識を追加：

```bash
# スキル作成ツールを使用
codex
> $skill-creator
```

**スキルの保存場所**:
- リポジトリ: `.agents/skills/`
- ユーザー: `~/.agents/skills/`
- 管理者: `/etc/codex/skills/`

**スキルのインストール**:

```bash
codex
> $skill-installer install the linear skill from the .experimental folder
```

### AGENTS.md

プロジェクトルートに`AGENTS.md`を作成して、Codexにプロジェクト固有の指示を提供：

```markdown
# プロジェクト指示

## コーディング規約
- TypeScriptを使用
- ESLintルールに従う
- すべての関数にJSDocコメントを追加

## テスト
- Jestを使用
- カバレッジ80%以上を維持

## コミットメッセージ
- Conventional Commits形式を使用
```

### 設定ファイル（config.toml）

`~/.codex/config.toml`で詳細な設定を管理：

```toml
# 承認ポリシー
approval_policy = "on-request"  # always | on-request | untrusted | never
sandbox_mode = "workspace-write"  # read-only | workspace-write | danger-full-access

# ネットワークアクセス
[sandbox_workspace_write]
network_access = false

# Web検索
web_search = "cached"  # disabled | cached | live

# MCPサーバー
[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]

# プロファイル
[profiles.full_auto]
approval_policy = "on-request"
sandbox_mode = "workspace-write"

[profiles.readonly_quiet]
approval_policy = "never"
sandbox_mode = "read-only"
```

**プロファイルの使用**:

```bash
codex --profile full_auto
codex --profile readonly_quiet
```

## セキュリティとサンドボックス

### サンドボックスモード

| モード | 説明 | 使用例 |
|--------|------|--------|
| `read-only` | ファイル読み取りのみ | コードレビュー、質問応答 |
| `workspace-write` | ワークスペース内の書き込み可 | 通常の開発作業（デフォルト） |
| `danger-full-access` | 制限なし | 信頼できる環境のみ |

### 承認ポリシー

| ポリシー | 説明 |
|----------|------|
| `always` | すべての操作で承認を求める |
| `on-request` | ワークスペース外やネットワークアクセス時に承認 |
| `untrusted` | 信頼できないコマンドのみ承認 |
| `never` | 承認なし（非推奨） |

### 推奨設定

```bash
# 安全な開発（デフォルト）
codex --sandbox workspace-write --ask-for-approval on-request

# 読み取り専用（安全）
codex --sandbox read-only --ask-for-approval on-request

# CI/CD（非対話）
codex --sandbox read-only --ask-for-approval never
```

### バージョン管理のベストプラクティス

1. **フィーチャーブランチで作業**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Gitチェックポイントを作成**
   ```bash
   git add .
   git commit -m "checkpoint: before codex changes"
   ```

3. **Codexで作業**
   ```bash
   codex
   ```

4. **変更を確認**
   ```bash
   git diff
   git status
   ```

5. **必要に応じてロールバック**
   ```bash
   git reset --hard HEAD
   ```

## トラブルシューティング

### エラー: "Command not found: codex"

**原因**: CLIがPATHに含まれていない

**解決策**:

```bash
# インストール確認
which codex

# npmのグローバルパスを確認
npm config get prefix

# PATHに追加（~/.bashrcまたは~/.zshrc）
export PATH="$PATH:$(npm config get prefix)/bin"

# 設定を再読み込み
source ~/.bashrc  # または source ~/.zshrc
```

### エラー: "Permission denied"

**原因**: 権限不足

**解決策**:

```bash
# Linuxの場合
sudo npm i -g @openai/codex

# または権限を修正
sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share}
```

### エラー: "Authentication failed"

**原因**: 認証情報が無効

**解決策**:

```bash
# 再認証
codex logout
codex

# APIキーを使用する場合
export OPENAI_API_KEY="your-api-key"
codex
```

### Windows: 拡張機能が応答しない

**原因**: C++開発ツールが不足

**解決策**:

```powershell
# Visual Studio Build Toolsをインストール
winget install --id Microsoft.VisualStudio.2022.BuildTools -e

# VS Codeを完全に再起動
```

### WSL: Codexが遅い

**原因**: `/mnt/c`配下で作業している

**解決策**:

```bash
# リポジトリをWSL内に移動
mkdir -p ~/code
cd ~/code
git clone https://github.com/your/repo.git
cd repo

# WSLのメモリとCPUを増やす
wsl --update
wsl --shutdown
```

### MCP: サーバーが起動しない

**原因**: 環境変数が設定されていない、またはコマンドが見つからない

**解決策**:

```bash
# 手動でテスト
npx -y @upstash/context7-mcp

# 環境変数を確認
echo $MY_ENV_VAR

# config.tomlを確認
cat ~/.codex/config.toml
```

## コマンドリファレンス

### 基本コマンド

```bash
# 対話型セッション開始
codex

# 特定のプロンプトを実行
codex exec "タスクの説明"

# バージョン確認
codex --version

# ヘルプ表示
codex --help
```

### MCPコマンド

```bash
# MCPサーバー追加
codex mcp add <name> -- <command>

# MCPサーバー一覧
codex mcp list

# MCPサーバー削除
codex mcp remove <name>

# OAuth認証
codex mcp login <server-name>
```

### サンドボックスコマンド

```bash
# サンドボックステスト（macOS）
codex sandbox macos --full-auto -- ls -la

# サンドボックステスト（Linux）
codex sandbox linux -- ls -la
```

### その他のコマンド

```bash
# ログアウト
codex logout

# 設定ファイルを開く
codex config edit

# ルールファイルをテスト
codex execpolicy check --rules ~/.codex/rules/default.rules -- <command>
```

## ベストプラクティス

1. **明確なプロンプトを書く**
   - 具体的な要件を記述
   - 期待する出力形式を指定
   - 制約条件を明示

2. **小さなタスクに分割**
   - 大きなタスクは複数のステップに分ける
   - 各ステップで結果を確認

3. **バージョン管理を活用**
   - 頻繁にコミット
   - フィーチャーブランチで作業
   - 変更前にチェックポイントを作成

4. **セキュリティを意識**
   - 適切なサンドボックスモードを選択
   - 承認ポリシーを設定
   - 機密情報を含むプロンプトに注意

5. **MCPサーバーを活用**
   - プロジェクトに関連するMCPサーバーを追加
   - 最新のドキュメントにアクセス
   - 外部ツールと連携

6. **Rulesで制御**
   - 危険なコマンドを禁止
   - 重要な操作に承認を要求
   - チーム全体でルールを共有

7. **Agent Skillsで拡張**
   - プロジェクト固有のワークフローをスキル化
   - 繰り返しタスクを自動化
   - チーム間でスキルを共有

## 追加リソース

- **公式ドキュメント**: https://developers.openai.com/codex
- **Changelog**: https://developers.openai.com/codex/changelog
- **GitHub（オープンソース）**: https://github.com/openai/codex
- **Agent Skills仕様**: https://github.com/openai/skills
- **OpenAI Discord**: コミュニティで質問や情報共有

---

**CLI Tool**: `codex`  
**Installation**: `npm install -g @openai/codex`
