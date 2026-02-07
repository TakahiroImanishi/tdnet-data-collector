---
inclusion: fileMatch
fileMatchPattern: '**/docs/**/*.md|**/README.md|**/.kiro/specs/**/*.md'
---

# TDnet Data Collector - ドキュメント標準

このファイルは、プロジェクト全体のドキュメント作成における言語規則とエンコーディング標準をまとめたものです。

---

## ドキュメント言語規則

### 基本方針

**説明文、コメント、ログメッセージは日本語で記述し、コード、ファイル名、技術用語は英語を使用すること。**

### 日本語で記述するもの

| 対象 | 例 | 備考 |
|------|------|------|
| ドキュメントの説明文 | 「この関数は開示情報を取得します」 | Markdown本文 |
| 要件定義書（requirements.md） | 「システムは日次で開示情報を収集する」 | - |
| 設計書（design.md） | 「DynamoDBのパーティションキーは...」 | - |
| steeringファイル | 「エラーハンドリングの基本原則」 | - |
| 改善記録（improvements/） | 「パフォーマンスの問題を改善」 | - |
| 作業記録（work-logs/） | 「Lambda関数を実装しました」 | - |
| READMEファイル | 「このプロジェクトは...」 | - |
| コード内コメント | `// 開示情報を取得` | コードブロック内 |
| ログメッセージ | `logger.info('データ取得開始')` | 実行時ログ |
| エラーメッセージ | `throw new Error('データが見つかりません')` | ユーザー向け |
| 一般的な日本語訳がある技術用語 | エラー、テスト、データベース | 文脈に応じて |

### 英語で記述するもの

| 対象 | 例 | 備考 |
|------|------|------|
| コード（変数名、関数名、クラス名） | `fetchDisclosureData()` | TypeScript/JavaScript慣習 |
| ファイル名 | `disclosure-collector.ts` | kebab-case推奨 |
| フォルダ名 | `lambda/collector/` | kebab-case推奨 |
| AWSサービス名 | Lambda, DynamoDB, S3, CloudWatch | 固有名詞 |
| 技術用語（一般） | API, JSON, HTTP, REST, CDK | 業界標準 |
| npm パッケージ名 | `aws-sdk`, `axios`, `jest` | 固有名詞 |
| 環境変数名 | `TDNET_API_URL` | UPPER_SNAKE_CASE |
| Git ブランチ名 | `feature/add-collector` | kebab-case推奨 |
| 外部APIのレスポンス | `{ "status": "success" }` | 元の言語のまま |

### コード例の扱い

**コードブロック内:**

```typescript
// ✅ 良い例: コメントは日本語、コードは英語
/**
 * 開示情報を取得する関数
 * @param disclosureId 開示情報ID
 * @returns 開示情報データ
 */
async function fetchDisclosureData(disclosureId: string): Promise<DisclosureData> {
    // データベースから取得
    const data = await dynamodb.get({ Key: { id: disclosureId } });
    
    if (!data) {
        // データが見つからない場合はエラー
        throw new Error('開示情報が見つかりません');
    }
    
    return data;
}
```

```typescript
// ❌ 悪い例: コメントが英語、または変数名が日本語
// Fetch disclosure data
async function 開示情報取得(kaiji_id: string) {
    // ...
}
```

**コードブロック外の説明:**

```markdown
✅ 良い例:

この関数は、DynamoDBから開示情報を取得します。`disclosureId`を指定して呼び出してください。

❌ 悪い例:

This function fetches disclosure data from DynamoDB.
```

### 技術用語の使い分け

| 日本語 | 英語 | 使用ルール |
|--------|------|-----------|
| エラー | Error | 説明文では「エラー」、コードでは`Error` |
| テスト | Test | 説明文では「テスト」、ファイル名では`*.test.ts` |
| データベース | Database | 説明文では「データベース」、コードでは`database` |
| 関数 | Function | 説明文では「関数」、コードでは`function` |
| 設定 | Config | 説明文では「設定」、コードでは`config` |
| Lambda | Lambda | 常に「Lambda」（AWSサービス名） |
| DynamoDB | DynamoDB | 常に「DynamoDB」（AWSサービス名） |
| API | API | 常に「API」（一般的な略語） |
| JSON | JSON | 常に「JSON」（一般的な略語） |

### 混在する場合の例

```markdown
✅ 良い例:

Lambda関数の`handler.ts`では、DynamoDBから開示情報を取得します。
エラーが発生した場合は、CloudWatch Logsに記録されます。

❌ 悪い例:

Lambdaファンクションのhandler.tsでは、DynamoDBからdisclosure dataをfetchします。
```

### 理由

- **日本語**: プロジェクトの主要な利用者が日本語話者であり、TDnetは日本の開示情報サービスのため
- **英語**: コードの可読性、国際的な開発慣習への準拠、ツールとの互換性のため
- **明確な区分**: 混乱を避け、一貫性のあるドキュメントとコードを維持するため

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

- `../core/tdnet-data-collector.md` - タスク実行ルール（ドキュメント作成の基本フロー）

