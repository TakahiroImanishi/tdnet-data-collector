---
inclusion: fileMatch
fileMatchPattern: '**/*.md|**/README.md'
---

# TDnet Data Collector - ドキュメント標準

このファイルは、プロジェクト全体のドキュメント作成における言語規則とエンコーディング標準をまとめたものです。

---

## ドキュメント言語規則

### 基本方針

**すべてのドキュメント、コメント、ログメッセージは日本語で記述すること。**

### 日本語で記述するもの

| 対象 | 言語 | 備考 |
|------|------|------|
| 要件定義書（requirements.md） | 日本語 | - |
| 設計書（design.md） | 日本語 | - |
| steeringファイル | 日本語 | - |
| 改善記録（improvements/） | 日本語 | - |
| 作業記録（work-logs/） | 日本語 | - |
| READMEファイル | 日本語 | - |
| コード内コメント | 日本語 | - |
| ログメッセージ | 日本語 | - |
| エラーメッセージ | 日本語 | ユーザー向け |

### 例外（英語のまま使用）

| 対象 | 理由 |
|------|------|
| コード自体（変数名、関数名、クラス名） | TypeScript/JavaScriptの慣習に従う |
| 技術用語（Lambda, DynamoDB, API等） | 業界標準の用語 |
| 外部APIのレスポンス | 元の言語のまま |

### 理由

- プロジェクトの主要な利用者が日本語話者
- TDnetは日本の開示情報サービス
- 日本語での記述により、理解と保守が容易

---

## ファイルエンコーディング規則

### 基本方針

**すべてのファイルはUTF-8エンコーディングで作成・保存すること。**

### エンコーディング一覧

| 対象 | エンコーディング | BOM | 備考 |
|------|----------------|-----|------|
| TypeScript/JavaScript | UTF-8 | なし | - |
| Markdown | UTF-8 | なし | - |
| JSON | UTF-8 | なし | - |
| YAML | UTF-8 | なし | - |
| HTML | UTF-8 | なし | `<meta charset="UTF-8">` を含める |
| CSV | UTF-8 | BOM付き推奨 | Excel互換性のため |
| テキストファイル | UTF-8 | なし | - |

### UTF-8を使用する理由

- **クロスプラットフォーム互換性**: Windows、macOS、Linuxで一貫した動作
- **Git差分の正確性**: 文字化けを防ぎ、正確な差分表示
- **日本語文字の正確な表現**: すべての日本語文字を正確に表現
- **CI/CD環境での一貫性**: 自動化環境での文字化け防止
- **国際標準への準拠**: UTF-8は国際標準のエンコーディング

---

## エディタ設定

### VS Code設定

**ファイル: `.vscode/settings.json`**

```json
{
  "files.encoding": "utf8",
  "files.autoGuessEncoding": false,
  "files.eol": "\n"
}
```

### Git設定

**ファイル: `.gitattributes`**

```
* text=auto eol=lf
*.ts text eol=lf
*.js text eol=lf
*.json text eol=lf
*.md text eol=lf
*.yaml text eol=lf
*.yml text eol=lf
```

**説明:**
- `text=auto`: Gitが自動的にテキストファイルを検出
- `eol=lf`: 改行コードをLF（Unix形式）に統一
- 各ファイルタイプで明示的にLFを指定

---

## プログラムでのファイル操作

### Node.js/TypeScriptでのファイル操作

**UTF-8エンコーディングを明示的に指定:**

```typescript
import { promises as fs } from 'fs';

// ファイル読み込み（UTF-8）
const content = await fs.readFile('file.txt', 'utf-8');

// ファイル書き込み（UTF-8）
await fs.writeFile('file.txt', content, 'utf-8');
```

### 日時の取得（ファイル名用）

**Windows (PowerShell):**
```powershell
Get-Date -Format "yyyyMMdd-HHmmss"
```

**macOS/Linux (Bash):**
```bash
date +"%Y%m%d-%H%M%S"
```

**Node.js (環境非依存):**
```javascript
new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15)
```

---

## ドキュメント作成のベストプラクティス

### 1. 見出しの階層構造

```markdown
# レベル1: ドキュメントタイトル
## レベル2: 主要セクション
### レベル3: サブセクション
#### レベル4: 詳細項目
```

### 2. 表の使用

**明確な情報整理:**

```markdown
| 項目 | 説明 | 備考 |
|------|------|------|
| 項目1 | 説明1 | 備考1 |
| 項目2 | 説明2 | 備考2 |
```

### 3. コードブロックの使用

**言語を明示:**

```markdown
```typescript
// TypeScriptコード
const example = 'Hello';
```
```

### 4. リンクの使用

**相対パスで関連ドキュメントへリンク:**

```markdown
詳細は [作業記録README](../../specs/tdnet-data-collector/work-logs/README.md) を参照。
```

### 5. 強調表示

- **太字**: `**重要な情報**`
- *斜体*: `*補足情報*`
- `コード`: `` `変数名` ``

---

## ファイル命名規則

### 作業記録

```
work-log-[YYYYMMDD-HHMMSS].md
```

**例:**
- `work-log-20260207-143025.md`
- `work-log-20260207-150530.md`

### 改善記録

```
task-[タスク番号]-improvement-[連番]-[YYYYMMDD-HHMMSS].md
```

**例:**
- `task-1.1-improvement-1-20260207-143025.md`
- `task-1.1-improvement-2-20260207-150530.md`

### READMEファイル

```
README.md
```

**配置場所:**
- プロジェクトルート: プロジェクト全体の説明
- 各ディレクトリ: そのディレクトリの説明

---

## ドキュメントテンプレート

### 作業記録テンプレート

```markdown
# 作業記録 - [作業タイトル]

**作成日時**: YYYY-MM-DD HH:MM:SS JST
**作業者**: Kiro AI Assistant
**関連タスク**: [タスク番号または説明]

## 作業概要
[作業の目的と概要を簡潔に記述]

## 実施内容
### 1. [作業項目1]
- 実施内容の詳細
- 変更したファイル
- 実行したコマンド

## 発生した問題と解決策
### 問題1: [問題の概要]
**状況:** [問題が発生した状況]
**原因:** [問題の原因]
**解決策:** [実施した解決策]

## 成果物
- [作成・更新したファイル一覧]
- [実行結果のサマリー]

## 次回への申し送り
- [次回作業時の注意点]
- [未完了の作業]
- [改善提案]
```

### 改善記録テンプレート

```markdown
# 改善記録 - タスク[番号] - [改善タイトル]

**作成日時**: YYYY-MM-DD HH:MM:SS JST
**関連タスク**: [タスク番号]
**改善連番**: [連番]

## 問題点の洗い出し

### 実装上の問題
- [問題1]
- [問題2]

### 設計上の問題
- [問題1]
- [問題2]

## 改善点の特定

### コードの改善
- [改善点1]
- [改善点2]

### 設計の改善
- [改善点1]
- [改善点2]

## 実施した改善内容

### 改善1: [改善タイトル]
**変更内容:** [詳細]
**変更ファイル:** [ファイル一覧]

## 改善結果の検証

- [ ] テスト実行結果
- [ ] パフォーマンス改善確認
- [ ] 新たな問題の有無

## 次回への申し送り
- [残課題]
- [今後の改善提案]
```

---

## 関連ドキュメント

- **タスク実行ルール**: `tdnet-data-collector.md` - 基本的なタスク実行フロー
- **ワークフローガイドライン**: `workflow-guidelines.md` - サブエージェント活用と並列実行
- **ファイル命名規則**: `tdnet-file-naming.md` - 詳細なファイル・フォルダ命名規則
- **作業記録**: `../../specs/tdnet-data-collector/work-logs/README.md` - 作業記録の詳細
- **改善記録**: `../../specs/tdnet-data-collector/improvements/README.md` - 改善記録の詳細
