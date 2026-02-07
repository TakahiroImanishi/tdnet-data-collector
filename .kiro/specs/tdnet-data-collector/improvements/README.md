# TDnet Data Collector - 改善履歴

このフォルダには、タスク実行後のフィードバックループで発見された問題と実施した改善を記録します。

## ファイル命名規則

各改善分析は以下の命名規則でファイルを作成してください：

### タスク関連の改善

```
task-[タスク番号]-improvement-[連番]-[YYYYMMDD-HHMMSS].md
```

- **タスク番号**: 実行したタスクの番号（例: 1.1, 2.3）
- **連番**: 同じタスクで複数回改善分析を行う場合の連番（1, 2, 3...）
- **日時**: 改善分析を実施した日時（YYYYMMdd-HHmmss形式）

例：
- `task-1.1-improvement-1-20260207-143025.md` - タスク1.1の1回目の改善分析
- `task-1.1-improvement-2-20260207-150530.md` - タスク1.1の2回目の改善分析
- `task-2.3-improvement-1-20260208-091530.md` - タスク2.3の1回目の改善分析

### ドキュメント関連の改善

```
docs-improvement-[連番]-[YYYYMMDD-HHMMSS].md
```

要件定義書、設計書、OpenAPI仕様などのドキュメント改善の記録。

例：
- `docs-improvement-1-20260207-122500.md` - ドキュメント構造の改善
- `docs-improvement-2-20260207-130000.md` - 整合性チェック結果

### Steering関連の改善

```
steering-improvement-[連番]-[YYYYMMDD-HHMMSS].md
```

steeringファイル（実装ガイドライン）の改善記録。

例：
- `steering-improvement-1-20260207-120500.md` - steeringファイルの整合性チェック
- `steering-improvement-2-20260207-115718.md` - エラーハンドリングパターンの追加

**重要:** `general-improvement-*.md` のような汎用的な命名は使用しないでください。必ず上記のいずれかのカテゴリに分類してください。

## 自動ファイル作成スクリプト

改善履歴ファイルを簡単に作成するためのPowerShellスクリプトを用意しています：

### create-improvement.ps1 - 改善記録作成

```powershell
# タスク番号を指定して実行
.\create-improvement.ps1 -TaskNumber "1.1"

# ドキュメント改善記録を作成
.\create-improvement.ps1 -Category "docs"

# Steering改善記録を作成
.\create-improvement.ps1 -Category "steering"

# 作成後に自動的にindex.mdを更新
.\create-improvement.ps1 -TaskNumber "1.1" -AutoUpdateIndex
```

スクリプトは以下を自動的に行います：
1. 正確なJST時刻を取得
2. 既存の改善ファイル数から連番を自動決定
3. テンプレート付きのファイルを作成
4. ファイルパスを表示
5. オプションでファイルを開く
6. オプションでindex.mdを自動更新

### update-index.ps1 - インデックス更新

```powershell
# index.mdを自動更新
.\update-index.ps1
```

スクリプトは以下を自動的に行います：
1. すべての改善記録ファイルをスキャン
2. カテゴリ別に分類（task, docs, steering）
3. タイトル、概要、優先度、タグを抽出
4. index.mdを自動生成
5. 統計情報を表示

## 記録フォーマット

各ファイルは以下の形式で記録してください：

```markdown
# タスク[タスク番号]完了後の改善

**実行日時:** [YYYY-MM-DD HH:MM:SS JST]

## 問題点

- [発見された問題の説明]

## 改善内容

- [実施した改善の説明]

## 影響範囲

- **requirements.md**: [変更内容]
- **design.md**: [変更内容]
- **steering**: [変更内容]
- **コード**: [変更内容]

## 検証結果

- [改善の効果]

## 優先度

[Critical / High / Medium / Low]
```

## 日時の取得方法

正確なJST（日本標準時）を取得するため、以下のいずれかの方法を使用してください：

1. **PowerShellコマンド（Windows）:**
   ```powershell
   Get-Date -Format "yyyy-MM-dd HH:mm:ss"
   ```

2. **Node.js（タイムゾーン指定）:**
   ```javascript
   new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
   ```

3. **手動記録の場合:**
   現在のシステム時刻がJSTであることを確認してから記録してください。
