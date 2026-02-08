# 作業記録: POST /collect、GET /collect/{execution_id} エンドポイント実装

**作成日時:** 2026-02-08 10:50:36  
**タスク:** タスク13.1-13.2 - API Collect エンドポイント実装  
**作業者:** Kiro AI Agent

---

## タスク概要

### 目的
TDnet Data Collector APIに以下のエンドポイントを実装する:
- POST /collect: Lambda Collectorを呼び出して開示情報収集を開始
- GET /collect/{execution_id}: 実行状態をDynamoDBから取得

### 背景
Phase 2のAPI実装において、開示情報収集を開始し、その実行状態を確認するエンドポイントが必要。

### 目標
- [ ] POST /collect エンドポイントの実装
- [ ] GET /collect/{execution_id} エンドポイントの実装
- [ ] CDK統合（API Gateway設定）
- [ ] ユニットテストの作成
- [ ] tasks.mdの進捗更新
- [ ] Gitコミット＆プッシュ

---

## 実施内容

### 1. 現状調査

既存のコードベースを確認:
- Lambda Collector: `src/lambda/collector/handler.ts`
- DynamoDB操作: `src/lambda/collector/update-execution-status.ts`
- API設計: `.kiro/specs/tdnet-data-collector/docs/openapi.yaml`

### 2. 実装計画

**POST /collect:**
1. リクエストボディのバリデーション（start_date、end_date）
2. Lambda Collector呼び出し（非同期）
3. execution_idを生成して返却
4. エラーハンドリング（400 Bad Request、500 Internal Server Error）

**GET /collect/{execution_id}:**
1. パスパラメータのバリデーション
2. DynamoDBクエリ（tdnet_executionsテーブル）
3. 実行状態を返却
4. エラーハンドリング（404 Not Found、500 Internal Server Error）

### 3. 実装作業

（実施した作業を随時記録）

---

## 成果物

（作成・変更したファイルを記録）

---

## 次回への申し送り

（未完了の作業、注意点を記録）

---

## 参考資料

- API設計ガイドライン: `.kiro/steering/api/api-design-guidelines.md`
- エラーコード標準: `.kiro/steering/api/error-codes.md`
- Lambda実装ガイドライン: `.kiro/steering/development/lambda-implementation.md`
- エラーハンドリング: `.kiro/steering/core/error-handling-patterns.md`
