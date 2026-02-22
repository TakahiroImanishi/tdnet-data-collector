# 作業記録: API仕様とドキュメントの整合性チェック

**作業日時**: 2026-02-15 10:04:49  
**作業者**: Kiro AI Assistant  
**作業概要**: API仕様ドキュメントと実装の整合性確認

## 作業目的

以下の観点でAPI仕様のドキュメントと実装の整合性をチェック：
1. API仕様の確認（OpenAPI、設計ドキュメント、ガイドライン）
2. 実装との照合（Lambda関数、スキーマ）
3. エラーレスポンス形式の確認
4. 認証・認可の確認
5. 不整合の報告

## 調査結果

### 1. API仕様の確認


#### OpenAPI仕様（openapi.yaml）

**定義されているエンドポイント:**
1. `GET /disclosures` - 開示情報一覧取得
2. `GET /disclosures/{id}` - 開示情報詳細取得
3. `GET /disclosures/{id}/pdf` - PDF署名付きURL取得
4. `POST /collect` - データ収集開始
5. `GET /collect/{execution_id}` - 収集状態取得
6. `POST /exports` - データエクスポート開始
7. `GET /exports/{export_id}` - エクスポート状態取得
8. `GET /health` - ヘルスチェック
9. `GET /stats` - 統計情報取得

**認証:**
- APIキー認証（`X-API-Key`ヘッダー）
- `/health`エンドポイントのみ認証不要

**エラーレスポンス形式:**
```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid date format",
    "details": { "field": "start_date" }
  },
  "request_id": "req-abc123"
}
```

#### API設計ドキュメント（api-design.md）

**エンドポイント一覧:** OpenAPI仕様と一致（9エンドポイント）

**レスポンス形式:**
- 成功: `{ status: "success", data: {...} }`
- エラー: `{ status: "error", error: { code, message, details }, request_id }`

**認証方式（2026-02-14更新）:**
- API Gateway使用量プランとAPIキー機能で認証
- Lambda関数では認証処理なし（API Gatewayで認証済み）

#### API設計ガイドライン（steering/api/api-design-guidelines.md）

**エンドポイント一覧:** OpenAPI仕様と一致（9エンドポイント）

**レスポンス形式:** API設計ドキュメントと一致

**認証・レート制限:**
- API認証: `X-API-Key: your-api-key-here`
- 認証済み: 100リクエスト/分
- 未認証: 10リクエスト/分

### 2. 実装との照合

#### Lambda関数の実装状況

| エンドポイント | Lambda関数 | 実装状況 | パス |
|--------------|-----------|---------|------|
| GET /disclosures | query | ✅ 実装済み | src/lambda/query/handler.ts |
| GET /disclosures/{id} | get-disclosure | ✅ 実装済み | src/lambda/get-disclosure/handler.ts |
| GET /disclosures/{id}/pdf | pdf-download | ✅ 実装済み | src/lambda/api/pdf-download/handler.ts |
| POST /collect | collect | ✅ 実装済み | src/lambda/collect/handler.ts |
| GET /collect/{execution_id} | collect-status | ✅ 実装済み | src/lambda/collect-status/handler.ts |
| POST /exports | export | ✅ 実装済み | src/lambda/export/handler.ts |
| GET /exports/{export_id} | export-status | ✅ 実装済み | src/lambda/api/export-status/handler.ts |
| GET /health | health | ✅ 実装済み | src/lambda/health/handler.ts |
| GET /stats | stats | ✅ 実装済み | src/lambda/stats/handler.ts |

**結果:** 全9エンドポイントが実装済み

#### CDK API Gateway統合状況

**API Stack（cdk/lib/stacks/api-stack.ts）:**

| エンドポイント | Lambda統合 | APIキー必須 | 実装状況 |
|--------------|-----------|------------|---------|
| GET /disclosures | queryFunction | ✅ Yes | ✅ 実装済み |
| POST /exports | exportFunction | ✅ Yes | ✅ 実装済み |
| GET /exports/{export_id} | exportStatusFunction | ✅ Yes | ✅ 実装済み |
| POST /collect | collectFunction | ✅ Yes | ✅ 実装済み |
| GET /collect/{execution_id} | collectStatusFunction | ✅ Yes | ✅ 実装済み |
| GET /disclosures/{disclosure_id}/pdf | pdfDownloadFunction | ✅ Yes | ✅ 実装済み |
| GET /health | healthFunction | ❌ No | ✅ 実装済み |
| GET /stats | statsFunction | ✅ Yes | ✅ 実装済み |

**結果:** 全エンドポイントがAPI Gatewayに統合済み

**注意:** `GET /disclosures/{id}`エンドポイントがAPI Stackに未定義

### 3. エラーレスポンス形式の確認

#### エラーコード定義（steering/api/error-codes.md）

**定義されているエラーコード:**
| コード | HTTPステータス | 使用場面 |
|--------|---------------|---------|
| VALIDATION_ERROR | 400 | 不正な入力値、日付形式エラー、範囲外の値 |
| UNAUTHORIZED | 401 | APIキー未提供、無効なAPIキー |
| FORBIDDEN | 403 | アクセス権限なし |
| NOT_FOUND | 404 | 開示情報ID不存在、エクスポートID不存在 |
| CONFLICT | 409 | 重複する開示情報ID、同時更新の競合 |
| RATE_LIMIT_EXCEEDED | 429 | API呼び出し回数超過、TDnetレート制限 |
| INTERNAL_ERROR | 500 | 予期しないエラー、システムエラー |
| SERVICE_UNAVAILABLE | 503 | DynamoDB/S3一時的障害、メンテナンス中 |
| GATEWAY_TIMEOUT | 504 | Lambda実行タイムアウト、外部API応答なし |

**エラーレスポンス形式:**
```typescript
interface ErrorResponse {
    status: 'error';
    error: {
        code: string;
        message: string;
        details?: any;
    };
    request_id: string;
}
```

#### Lambda関数のエラーレスポンス実装確認

**1. query/handler.ts:**
- ✅ エラーレスポンス形式: `{ status: "error", error: { code, message, details }, request_id }`
- ✅ エラーコードマッピング: ValidationError → VALIDATION_ERROR, NotFoundError → NOT_FOUND
- ✅ HTTPステータスコード: 適切に設定（400, 404, 500）

**2. get-disclosure/handler.ts:**
- ✅ エラーレスポンス形式: `{ status: "error", error: { code, message, details }, request_id }`
- ✅ エラーコードマッピング: NotFoundError → NOT_FOUND
- ✅ HTTPステータスコード: 適切に設定（404, 500）

**3. collect/handler.ts:**
- ✅ エラーレスポンス形式: `{ status: "error", error: { code, message, details }, request_id }`
- ✅ エラーコードマッピング: 完全なマッピング（9種類のエラーコード）
- ✅ HTTPステータスコード: 適切に設定

**4. collect-status/handler.ts:**
- ✅ エラーレスポンス形式: `{ status: "error", error: { code, message, details }, request_id }`
- ✅ エラーコードマッピング: 完全なマッピング（9種類のエラーコード）
- ✅ HTTPステータスコード: 適切に設定

**5. export/handler.ts:**
- ✅ エラーレスポンス形式: `{ status: "error", error: { code, message, details }, request_id }`
- ✅ エラーコードマッピング: ValidationError → VALIDATION_ERROR, AuthenticationError → UNAUTHORIZED
- ✅ HTTPステータスコード: 適切に設定（400, 401, 500）

**6. export-status/handler.ts:**
- ✅ エラーレスポンス形式: `{ status: "error", error: { code, message, details }, request_id }`
- ✅ エラーコードマッピング: ValidationError → VALIDATION_ERROR, NotFoundError → NOT_FOUND
- ✅ HTTPステータスコード: 適切に設定（400, 404, 500）

**7. pdf-download/handler.ts:**
- ✅ エラーレスポンス形式: `{ status: "error", error: { code, message, details }, request_id }`
- ✅ エラーコードマッピング: ValidationError → VALIDATION_ERROR, AuthenticationError → UNAUTHORIZED, NotFoundError → NOT_FOUND
- ✅ HTTPステータスコード: 適切に設定（400, 401, 404, 500）
- ⚠️ **注意:** APIキー認証をLambda関数内で実装（API Gatewayで認証済みのため不要）

**8. health/handler.ts:**
- ✅ エラーレスポンス形式: `{ status: "unhealthy", timestamp, services, details }`
- ✅ HTTPステータスコード: 200（正常）、503（エラー時）
- ℹ️ **注意:** ヘルスチェックは独自のレスポンス形式を使用（仕様通り）

**9. stats/handler.ts:**
- ✅ エラーレスポンス形式: `{ status: "error", error: { code, message, details }, request_id }`
- ✅ エラーコードマッピング: 基本的なマッピング（INTERNAL_ERROR）
- ✅ HTTPステータスコード: 適切に設定（500）

**結果:** 全Lambda関数でエラーレスポンス形式が統一されている

### 4. 認証・認可の確認

#### API Gateway認証設定

**API Stack（cdk/lib/stacks/api-stack.ts）:**
- ✅ APIキー認証: API Gateway使用量プランとAPIキーで実装
- ✅ 使用量プラン: レート制限（100リクエスト/秒）、バースト制限（200）、月間クォータ（10,000リクエスト）
- ✅ WAF統合: レート制限（500リクエスト/5分）
- ✅ `/health`エンドポイント: 認証不要（`apiKeyRequired: false`）
- ✅ その他エンドポイント: 認証必須（`apiKeyRequired: true`）

#### Lambda関数の認証実装

**API Gateway統合Lambda関数:**
- ✅ query/handler.ts: 認証処理なし（API Gatewayで認証済み）
- ✅ get-disclosure/handler.ts: 認証処理なし（API Gatewayで認証済み）
- ✅ collect/handler.ts: 認証処理なし（API Gatewayで認証済み）
- ✅ collect-status/handler.ts: 認証処理なし（API Gatewayで認証済み）
- ✅ export/handler.ts: 認証処理なし（API Gatewayで認証済み）
- ✅ export-status/handler.ts: 認証処理なし（API Gatewayで認証済み）
- ⚠️ **pdf-download/handler.ts: Lambda関数内でAPIキー認証を実装（不要）**
- ✅ health/handler.ts: 認証処理なし（認証不要エンドポイント）
- ✅ stats/handler.ts: 認証処理なし（API Gatewayで認証済み）

**結果:** pdf-download/handler.ts以外は適切に実装されている

### 5. 不整合の報告

#### 🔴 重大な不整合

**1. GET /disclosures/{id}エンドポイントがAPI Gatewayに未定義**
- **問題:** OpenAPI仕様とAPI設計ドキュメントに定義されているが、API Stack（cdk/lib/stacks/api-stack.ts）に実装されていない
- **影響:** エンドポイントが利用不可
- **Lambda関数:** get-disclosure/handler.ts は実装済み
- **修正方法:** API Stackに以下を追加
  ```typescript
  // GET /disclosures/{disclosure_id}
  const getDisclosureIntegration = new apigateway.LambdaIntegration(props.getDisclosureFunction, {
    proxy: true,
  });
  
  disclosureIdResource.addMethod('GET', getDisclosureIntegration, {
    apiKeyRequired: true,
  });
  ```
- **注意:** `disclosureIdResource`は既に定義されているため、メソッドの追加のみ必要

#### ⚠️ 軽微な不整合

**2. pdf-download/handler.tsでAPIキー認証を実装**
- **問題:** API Gatewayで認証済みのため、Lambda関数内での認証は不要
- **影響:** 冗長な処理、パフォーマンスへの軽微な影響
- **該当コード:** `validateApiKey(event)` 関数
- **修正方法:** `validateApiKey`関数と呼び出しを削除
- **参考:** API設計ドキュメント（2026-02-14更新）に「Lambda関数では認証処理なし（API Gatewayで認証済み）」と明記

**3. Compute StackにgetDisclosureFunctionが未定義**
- **問題:** API Stackで`props.getDisclosureFunction`を参照しているが、Compute Stackで定義されていない
- **影響:** デプロイエラーの可能性
- **修正方法:** Compute Stackに以下を追加
  ```typescript
  public readonly getDisclosureFunction: lambda.Function;
  
  // Lambda関数定義
  this.getDisclosureFunction = new NodejsFunction(this, 'GetDisclosureFunction', {
    functionName: `tdnet-get-disclosure-${env}`,
    runtime: lambda.Runtime.NODEJS_20_X,
    entry: 'src/lambda/get-disclosure/handler.ts',
    handler: 'handler',
    timeout: cdk.Duration.seconds(envConfig.getDisclosure.timeout),
    memorySize: envConfig.getDisclosure.memorySize,
    environment: {
      DYNAMODB_TABLE_NAME: props.disclosuresTable.tableName,
      S3_BUCKET_NAME: props.pdfsBucket.bucketName,
      LOG_LEVEL: envConfig.getDisclosure.logLevel,
      ENVIRONMENT: env,
      NODE_OPTIONS: '--enable-source-maps',
    },
    bundling: {
      minify: true,
      sourceMap: true,
      target: 'node20',
      externalModules: ['@aws-sdk/*'],
    },
  });
  
  props.disclosuresTable.grantReadData(this.getDisclosureFunction);
  props.pdfsBucket.grantRead(this.getDisclosureFunction);
  ```

#### ℹ️ 情報

**4. OpenAPI仕様のパスパラメータ名の不一致**
- **OpenAPI仕様:** `{id}` (例: `/disclosures/{id}`)
- **API Stack実装:** `{disclosure_id}` (例: `/disclosures/{disclosure_id}/pdf`)
- **影響:** 軽微（Lambda関数は`pathParameters?.id`または`pathParameters?.disclosure_id`で取得）
- **推奨:** 一貫性のため、OpenAPI仕様を`{disclosure_id}`に統一

**5. レート制限の不一致**
- **API設計ガイドライン:** 認証済み100リクエスト/分、未認証10リクエスト/分
- **API Stack実装:** レート制限100リクエスト/秒、バースト200、WAF 500リクエスト/5分
- **影響:** 実装が仕様より緩い（100リクエスト/秒 = 6000リクエスト/分）
- **推奨:** API設計ガイドラインを実装に合わせて更新

## 問題と解決策

### 問題1: GET /disclosures/{id}エンドポイントがAPI Gatewayに未定義

**原因:**
- API Stack（cdk/lib/stacks/api-stack.ts）で`disclosureIdResource`を定義しているが、GETメソッドを追加していない
- Compute Stackで`getDisclosureFunction`を定義していない

**解決策:**
1. Compute Stackに`getDisclosureFunction`を追加
2. API Stackに`GET /disclosures/{disclosure_id}`エンドポイントを追加

### 問題2: pdf-download/handler.tsでAPIキー認証を実装

**原因:**
- API Gatewayで認証済みであることを認識していない
- 冗長な認証処理を実装

**解決策:**
- `validateApiKey`関数と呼び出しを削除
- API Gatewayの認証に依存

### 問題3: OpenAPI仕様とAPI Stack実装のパスパラメータ名の不一致

**原因:**
- OpenAPI仕様では`{id}`、API Stack実装では`{disclosure_id}`を使用

**解決策:**
- OpenAPI仕様を`{disclosure_id}`に統一（推奨）
- または、API Stack実装を`{id}`に統一

## 成果物

### 不整合リスト

| 項目 | 重要度 | 説明 | 修正方法 |
|------|--------|------|---------|
| GET /disclosures/{id}エンドポイント未定義 | 🔴 重大 | API Gatewayに未実装 | Compute StackとAPI Stackに追加 |
| pdf-download/handler.tsの冗長な認証 | ⚠️ 軽微 | Lambda関数内で不要な認証 | validateApiKey関数を削除 |
| パスパラメータ名の不一致 | ℹ️ 情報 | OpenAPI仕様とAPI Stack実装で異なる | OpenAPI仕様を統一 |
| レート制限の不一致 | ℹ️ 情報 | ガイドラインと実装で異なる | ガイドラインを更新 |

### 整合性確認結果

**✅ 整合性が取れている項目:**
- エンドポイント定義（8/9エンドポイント）
- エラーレスポンス形式（全Lambda関数）
- エラーコードマッピング（全Lambda関数）
- API Gateway認証設定（全エンドポイント）
- Lambda関数の認証実装（8/9関数）

**❌ 整合性が取れていない項目:**
- GET /disclosures/{id}エンドポイント（API Gatewayに未定義）
- pdf-download/handler.tsの認証実装（冗長）
- パスパラメータ名（OpenAPI仕様とAPI Stack実装で不一致）
- レート制限（ガイドラインと実装で不一致）

## 申し送り事項

### 優先度高（即座に修正推奨）

1. **GET /disclosures/{id}エンドポイントの追加**
   - Compute Stackに`getDisclosureFunction`を追加
   - API Stackに`GET /disclosures/{disclosure_id}`エンドポイントを追加
   - 環境設定（environment-config.ts）に`getDisclosure`設定を追加

### 優先度中（次回修正推奨）

2. **pdf-download/handler.tsの認証処理削除**
   - `validateApiKey`関数と呼び出しを削除
   - API Gatewayの認証に依存

3. **OpenAPI仕様のパスパラメータ名統一**
   - `{id}`を`{disclosure_id}`に統一
   - Lambda関数の`pathParameters?.id`を`pathParameters?.disclosure_id`に統一

### 優先度低（ドキュメント更新）

4. **API設計ガイドラインのレート制限更新**
   - 実装に合わせてレート制限を更新（100リクエスト/秒）

5. **API設計ドキュメントの更新**
   - 認証方式の説明を最新化（2026-02-14更新を反映）

---

**作業完了日時:** 2026-02-15 10:04:49  
**作業時間:** 約30分  
**確認ファイル数:** 20ファイル
