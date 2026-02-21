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

説明文、コメント、ログメッセージ

### 英語で記述

コード（変数・関数・クラス名）、ファイル名、AWSサービス名、技術用語、環境変数名

## ファイルエンコーディング

すべてのファイルはUTF-8（BOMなし）で作成。

| ファイル種別 | エンコーディング |
|------------|----------------|
| TypeScript/JavaScript/Markdown/JSON/YAML | UTF-8 BOMなし |
| CSV | UTF-8 BOM付き（Excel互換） |

## 日時取得

```powershell
Get-Date -Format "yyyyMMdd-HHmmss"
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

## 関連

`../core/tdnet-data-collector.md`