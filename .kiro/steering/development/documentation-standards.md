---
inclusion: fileMatch
fileMatchPattern: '**/docs/**/*.md|README.md|**/.kiro/specs/**/*.md'
---

# ドキュメント標準

プロジェクト全体のドキュメント作成における言語規則とエンコーディング標準。

## 言語規則

### 基本方針

説明文・コメント・ログは日本語、コード・ファイル名・技術用語は英語。

### 日本語で記述

| 対象 | 例 |
|------|------|
| ドキュメント本文 | 「この関数は開示情報を取得します」 |
| コード内コメント | `// 開示情報を取得` |
| ログメッセージ | `logger.info('データ取得開始')` |
| エラーメッセージ | `throw new Error('データが見つかりません')` |

### 英語で記述

| 対象 | 例 |
|------|------|
| コード（変数・関数・クラス名） | `fetchDisclosureData()` |
| ファイル名 | `disclosure-collector.ts` |
| AWSサービス名 | Lambda, DynamoDB, S3 |
| 技術用語 | API, JSON, HTTP, REST, CDK |
| 環境変数名 | `TDNET_API_URL` |

### コード例

```typescript
// ✅ 良い例
/**
 * 開示情報を取得する関数
 * @param disclosureId 開示情報ID
 */
async function fetchDisclosureData(disclosureId: string) {
    // データベースから取得
    const data = await dynamodb.get({ Key: { id: disclosureId } });
    if (!data) throw new Error('開示情報が見つかりません');
    return data;
}

// ❌ 悪い例: コメントが英語、または変数名が日本語
async function 開示情報取得(kaiji_id: string) { }
```

## ファイルエンコーディング

### 基本方針

すべてのファイルはUTF-8エンコーディング（BOMなし）で作成・保存。

| ファイル種別 | エンコーディング | BOM |
|------------|----------------|-----|
| TypeScript/JavaScript/Markdown/JSON/YAML | UTF-8 | なし |
| CSV | UTF-8 | BOM付き推奨（Excel互換） |

### エディタ設定

**VS Code:** `.vscode/settings.json`

```json
{
  "files.encoding": "utf8",
  "files.autoGuessEncoding": false,
  "files.eol": "\n"
}
```

**Git:** `.gitattributes`

```
* text=auto eol=lf
*.ts text eol=lf
*.js text eol=lf
*.json text eol=lf
*.md text eol=lf
```

### ファイル操作

```typescript
// Node.js/TypeScript
const content = await fs.readFile('file.txt', 'utf-8');
await fs.writeFile('file.txt', content, 'utf-8');
```

### 日時取得

```powershell
# Windows
Get-Date -Format "yyyyMMdd-HHmmss"
```

```javascript
// Node.js
new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15)
```

## ドキュメント作成

### 見出し階層

```markdown
# レベル1: ドキュメントタイトル
## レベル2: 主要セクション
### レベル3: サブセクション
```

### 表の使用

```markdown
| 項目 | 説明 | 備考 |
|------|------|------|
| 項目1 | 説明1 | 備考1 |
```

### コードブロック

```markdown
```typescript
const example = 'Hello';
```
```

### リンク

```markdown
詳細は [作業記録README](../../specs/tdnet-data-collector/work-logs/README.md) を参照。
```

## ファイル命名規則

### 作業記録

```
work-log-[YYYYMMDD-HHMMSS].md
```

例: `work-log-20260207-143025.md`

### 改善記録

```
task-[タスク番号]-improvement-[連番]-[YYYYMMDD-HHMMSS].md
```

例: `task-1.1-improvement-1-20260207-143025.md`

## 関連ドキュメント

- `../core/tdnet-data-collector.md` - タスク実行ルール

