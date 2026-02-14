# 作業記録: タスク31.3.13〜31.3.18実行

**作成日時**: 2026-02-15 06:42:56  
**担当**: Subagent D  
**タスク**: 設計と実装の整合性修正（Phase 1: Medium優先度）

## 実行タスク

### 31.3.13 DLQ設定の方針確認（Medium）
- 設計書の意図を明確化
- API Lambda関数にDLQが必要か判断
- 必要に応じてCDK修正

### 31.3.14 Secrets Managerローテーション実装（Medium）
- `src/lambda/api-key-rotation/index.ts` を作成
- または、ローテーション機能をPhase 4まで無効化

### 31.3.15 WAFレート制限の仕様確認（Medium）
- AWS WAFの `limit` パラメータの仕様を確認
- Steering Filesの記述を明確化
- 必要に応じてCDK修正

### 31.3.16 エラーレスポンス形式の修正（Medium）
- API Gatewayの `requestContext.requestId` を使用
- 全Lambda関数のエラーレスポンスを修正
- E2Eテスト更新

### 31.3.17 ファイルサイズバリデーション追加（Medium）
- `src/models/disclosure.ts` にファイルサイズのバリデーションを追加
- 10MBを超えるファイルを拒否
- ユニットテスト追加

### 31.3.18 API設計書の更新（Medium）
- `design/api-design.md` に `total_count` フィールドを追加
- OpenAPI仕様との整合性を確認

---

## 作業ログ

### Phase 1: 現状分析


#### 分析結果

**現状確認:**
1. **DLQ設定**: Collector FunctionのみDLQ設定あり（compute-stack.ts）
2. **API Lambda関数**: Query, Export, Collect, CollectStatus, ExportStatus, PdfDownload, Health, Stats - DLQ設定なし
3. **エラーレスポンス**: `context.awsRequestId` を使用（API Gateway `requestContext.requestId` ではない）
4. **ファイルサイズバリデーション**: `src/models/disclosure.ts` に未実装
5. **API設計書**: `total_count` フィールドの記載なし
6. **WAF設定**: `rateLimitPerFiveMinutes: 2000` - AWS WAFの仕様確認が必要

---

## Phase 2: タスク実行

### タスク31.3.13: DLQ設定の方針確認

**調査結果:**
- **現状**: Collector FunctionのみDLQ設定あり
- **設計書の意図**: error-handling-patterns.mdでは「DLQ設定（SQS/Lambda）」が必須実装として記載
- **判断**: API Lambda関数は同期呼び出しのため、DLQは不要
  - API Gateway → Lambda: 同期呼び出し（エラーは即座にAPI Gatewayに返却）
  - Collector Function: 非同期呼び出し（DLQ必要）

**結論**: 現状の実装は正しい。API Lambda関数にDLQは不要。

**Steering Files更新**: error-handling-patterns.mdを明確化


✅ **完了**: error-handling-patterns.mdを更新（DLQ設定の適用範囲を明確化）

---

### タスク31.3.14: Secrets Managerローテーション実装

**調査結果:**
- `src/lambda/api-key-rotation/index.ts` は既に存在
- Phase 4で実装予定の機能

**判断**: Phase 4まで無効化（現状維持）

**対応**: 作業記録に記載のみ


✅ **確認**: api-key-rotation/index.tsは既に実装済み（Phase 4で有効化予定）

---

### タスク31.3.15: WAFレート制限の仕様確認

**AWS WAF仕様調査:**
- `rateBasedStatement.limit`: 5分間のリクエスト数制限
- 現在の設定: `rateLimitPerFiveMinutes: 2000` = 2000リクエスト/5分
- 計算: 2000 / 5 = 400リクエスト/分 = 6.67リクエスト/秒

**Steering Files確認:**
- api-design-guidelines.md: 「認証済み: 100リクエスト/分」と記載
- 実装との不整合: 400リクエスト/分 vs 100リクエスト/分

**修正方針:**
1. WAF設定を100リクエスト/分に変更: `limit: 500`（100リクエスト/分 × 5分）
2. Steering Filesを明確化


✅ **完了**: WAFレート制限を修正（2000 → 500リクエスト/5分 = 100リクエスト/分）

---

### タスク31.3.16: エラーレスポンス形式の修正

**現状:**
- Lambda関数: `context.awsRequestId` を使用
- API設計書: `request_id` フィールドに記載

**API Gateway統合の仕様:**
- `context.requestId`: Lambda実行のリクエストID
- `event.requestContext.requestId`: API GatewayのリクエストID

**判断:**
- API Gatewayのリクエスト IDを使用する方が適切
- 全Lambda関数のエラーレスポンスを修正

**対象ファイル:**
1. src/lambda/query/handler.ts
2. src/lambda/get-disclosure/handler.ts
3. src/lambda/collect/handler.ts
4. src/lambda/collect-status/handler.ts
5. src/lambda/export/handler.ts
6. src/lambda/api/export-status/handler.ts
7. src/lambda/api/pdf-download/handler.ts
8. src/lambda/stats/handler.ts


✅ **完了**: 全Lambda関数のエラーレスポンスを修正（`context.awsRequestId` → `event.requestContext.requestId`）

**修正ファイル:**
- src/lambda/query/handler.ts
- src/lambda/get-disclosure/handler.ts
- src/lambda/collect/handler.ts
- src/lambda/collect-status/handler.ts
- src/lambda/export/handler.ts
- src/lambda/api/export-status/handler.ts
- src/lambda/api/pdf-download/handler.ts
- src/lambda/stats/handler.ts

---

### タスク31.3.17: ファイルサイズバリデーション追加

**実装内容:**
- `src/models/disclosure.ts` にファイルサイズのバリデーションを追加
- 10MBを超えるファイルを拒否
- ユニットテスト追加


✅ **完了**: ファイルサイズバリデーション追加
- `src/models/disclosure.ts`: 10MB制限を追加
- `src/models/__tests__/disclosure.test.ts`: ユニットテスト追加（境界値テスト含む）

---

### タスク31.3.18: API設計書の更新

**実装内容:**
- `design/api-design.md` に `total_count` フィールドを追加
- OpenAPI仕様との整合性を確認
