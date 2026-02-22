# 作業記録: manual-data-collection.ps1 APIキー取得処理の改善（タスク5）

**作業日時**: 2026-02-22 16:07:49  
**担当**: サブエージェント2  
**タスク**: タスク5 - manual-data-collection.ps1への適用

## 作業概要

fetch-data-range.ps1で実装したAPIキー取得処理の改善を、manual-data-collection.ps1にも適用する。

## タスク詳細

**実装内容**:
1. `Get-ApiKeyWithRetry` 関数を実装
2. 環境変数フォールバック機能を追加（`TDNET_API_KEY`）
3. エラーメッセージを改善（SECRET_NOT_FOUND, ACCESS_DENIED, NETWORK_ERROR）
4. PowerShellスクリプトのエンコーディング設定を確認（UTF-8 BOMなし）

**参考**: タスクファイル `.kiro/specs/tdnet-data-collector/tasks/tasks-fetch-data-range-api-key-issue.md`

## 実施内容

### 1. 現状確認

**現在の実装**:
- Secrets Managerから直接APIキーを取得
- エラー時に簡易的なメッセージを表示
- リトライ機能なし
- 環境変数フォールバックなし

### 2. 改善実装

