# エラーハンドリング・バリデーション整合性点検

**作業日時**: 2026-02-23 13:58:48  
**担当**: Subagent3  
**タスク**: エラーハンドリング・バリデーション整合性点検

## 目的

以下の整合性を確認:
1. カスタムエラークラスの定義と使用方法
2. 再試行ユーティリティの実装と使用方法
3. Zodスキーマと型定義の一致

## 点検対象

### 1. カスタムエラークラス
- `src/errors/index.ts`
- 各Lambdaの`handler.ts`

### 2. 再試行ユーティリティ
- `src/utils/retry.ts`
- 各Lambdaでの使用箇所

### 3. Zodスキーマ
- `src/validators/*.ts`
- 各Lambdaでのバリデーション使用箇所

## 点検結果


### 1. カスタムエラークラス

#### 定義（src/errors/index.ts）

**エラー階層**:
```
TDnetError (基底クラス)
├── RetryableError (再試行可能)
│   ├── RateLimitError
│   └── DownloadError
├── ValidationError (再試行不可)
├── NotFoundError (再試行不可)
├── AuthenticationError (再試行不可)
└── ConfigurationError (再試行不可)
```

**エラー分類**:
- **Retryable**: `RetryableError`, `RateLimitError`, `DownloadError`
- **Non-Retryable**: `ValidationError`, `NotFoundError`, `AuthenticationError`, `ConfigurationError`

#### 使用状況

**Lambda関数でのインポート**:
| Lambda関数 | インポートされたエラークラス |
|-----------|---------------------------|
| collector-init | `ValidationError` |
| collector-fetch | `ValidationError`, `RetryableError` |
| collector-aggregate | なし（エラークラス未使用） |
| collector-save | なし（エラークラス未使用） |
| query | `ValidationError`, `NotFoundError`, `AuthenticationError` |
| get-disclosure | `NotFoundError` |
| export | `ValidationError`, `AuthenticationError` |
| collect | `ValidationError` |
| collector | `ValidationError` |
| api/pdf-download | `ValidationError`, `NotFoundError`, `AuthenticationError` |
| collect-status | `ValidationError`, `NotFoundError` |
| api/export-status | `ValidationError`, `NotFoundError`, `AuthenticationError` |

**不整合検出**:
- ✅ **整合性あり**: エラークラスの定義と使用方法は一貫している
- ⚠️ **改善余地**: `collector-aggregate`, `collector-save`でエラークラスが未使用（汎用Errorを使用）

---

### 2. 再試行ユーティリティ

#### 定義（src/utils/retry.ts）

**関数シグネチャ**:
```typescript
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T>

export function isRetryableError(error: unknown): boolean
```

**RetryOptions**:
```typescript
interface RetryOptions {
  maxRetries: number;          // デフォルト: 3
  initialDelay: number;        // デフォルト: 2000ms
  backoffMultiplier: number;   // デフォルト: 2
  jitter: boolean;             // デフォルト: true
  shouldRetry?: (error: Error) => boolean;
}
```

#### 使用状況

**Lambda関数での使用**:
| Lambda関数 | 使用箇所 | 用途 |
|-----------|---------|------|
| collector-fetch | `fetchTdnetPage()` | TDnet APIからのHTMLページ取得 |
| api/export-status | DynamoDB GetItem | 実行状態取得 |
| api/pdf-download | DynamoDB GetItem, S3 GetObject | メタデータ取得、PDF取得 |

**不整合検出**:
- ✅ **整合性あり**: `retryWithBackoff`の実装と使用方法は一貫している
- ✅ **エラー分類**: `isRetryableError`は`RetryableError`インスタンスとネットワークエラー、5xx、429を正しく判定
- ⚠️ **改善余地**: 他のLambda関数（collector-save, collector-aggregate等）で外部API/AWS SDK呼び出しに再試行が未実装

---

### 3. Zodスキーマ

#### 定義（src/validators/disclosure-schema.ts）

**主要スキーマ**:
```typescript
export const disclosureSchema = z.object({
  disclosure_id: z.string().regex(/^\d{8}_\d{4}_\d{3}$/),
  company_code: z.string().regex(/^\d{4}$/).refine(...),
  company_name: z.string().min(1),
  disclosure_type: z.string().min(1),
  title: z.string().min(1),
  disclosed_at: iso8601Schema,
  pdf_url: urlSchema,
  pdf_s3_key: s3KeySchema,
  file_size: fileSizeSchema,
  downloaded_at: iso8601Schema,
  date_partition: datePartitionSchema,
});

export const collectionResultSchema = z.object({ ... });
export const executionStatusSchema = z.object({ ... });
export const queryFilterSchema = z.object({ ... });
```

**バリデーション関数**:
```typescript
export function validateDisclosureWithZod(data: unknown): DisclosureZod
export function safeValidateDisclosure(data: unknown)
```

#### 使用状況

**Lambda関数での使用**:
- ❌ **未使用**: すべてのLambda関数でZodスキーマが直接インポート・使用されていない
- ✅ **代替実装**: 各Lambda関数で独自のバリデーション関数を実装（`validateEvent`, `validateApiKey`, `validateDisclosureId`等）

**バリデーション実装パターン**:
| Lambda関数 | バリデーション関数 | 実装方法 |
|-----------|------------------|---------|
| collector-init | `validateEvent()` | 手動バリデーション（正規表現、型チェック） |
| collector-fetch | `validateEvent()` | 手動バリデーション |
| query | `validateDateFormat()`, `validateMonthFormat()`, `validateApiKey()` | 手動バリデーション |
| api/pdf-download | `validateApiKey()`, `validateDisclosureId()`, `validateExpiration()` | 手動バリデーション |
| export | `validateApiKey()`, `validateRequestBody()` | 手動バリデーション |
| collect | `validateRequest()` | 手動バリデーション |
| collector | `validateEvent()` | 手動バリデーション |

**不整合検出**:
- ⚠️ **重大な不整合**: Zodスキーマが定義されているが、実際には使用されていない
- ⚠️ **重複実装**: 各Lambda関数で独自のバリデーションロジックを実装（DRY原則違反）
- ⚠️ **型安全性**: Zodスキーマから推論される型（`DisclosureZod`）が活用されていない

---

### 4. テストでのエラー分類検証

#### テスト実装状況

**Retryableエラーのテスト**:
- ✅ `src/lambda/collector-fetch/__tests__/handler.test.ts`:
  - ネットワークエラー → `RetryableError`
  - タイムアウトエラー → `RetryableError`
  - 5xxエラー → `RetryableError`
  - 429エラー → `RetryableError`

- ✅ `src/utils/__tests__/retry.test.ts`:
  - `RetryableError`の再試行動作
  - `isRetryableError()`の判定ロジック（ECONNRESET, ETIMEDOUT, 5xx, 429等）

- ✅ `src/utils/__tests__/secrets-manager.test.ts`:
  - `ThrottlingException` → 再試行
  - `InternalServiceError` → 再試行

**Non-Retryableエラーのテスト**:
- ✅ `src/utils/__tests__/retry.test.ts`:
  - `ValidationError` → 再試行なし
  - `NotFoundError` → 再試行なし
  - HTTP 400, 404 → 再試行なし

**不整合検出**:
- ✅ **整合性あり**: テストはエラー分類パターン（`error-handling-patterns.md`）に準拠
- ⚠️ **カバレッジ不足**: 他のLambda関数（collector-aggregate, collector-save等）でエラー分類テストが不足

---

## 検出された不整合の優先順位

### 優先度: 高

#### 1. Zodスキーマの未使用
**問題**: Zodスキーマが定義されているが、実際には使用されていない。各Lambda関数で独自のバリデーションロジックを実装。

**影響**:
- コードの重複（DRY原則違反）
- 型安全性の欠如
- バリデーションルールの不整合リスク

**推奨対応**:
- Zodスキーマを各Lambda関数で活用
- 手動バリデーションをZodスキーマに置き換え
- 型定義を`DisclosureZod`に統一

#### 2. collector-aggregate/collector-saveでのエラークラス未使用
**問題**: Step Functions統合Lambda（collector-aggregate, collector-save）でカスタムエラークラスが未使用。

**影響**:
- エラー分類が不明確
- 再試行ロジックの適用が困難
- ログ・メトリクスでのエラー追跡が不正確

**推奨対応**:
- `ValidationError`, `RetryableError`等を適切に使用
- エラーハンドリングを統一

### 優先度: 中

#### 3. 再試行ロジックの未実装
**問題**: 一部のLambda関数で外部API/AWS SDK呼び出しに再試行ロジックが未実装。

**影響**:
- 一時的なエラーで処理が失敗
- システムの可用性低下

**推奨対応**:
- `retryWithBackoff`を適用（DynamoDB, S3, 外部API呼び出し）
- AWS SDKの`maxAttempts`設定を確認

#### 4. エラー分類テストのカバレッジ不足
**問題**: collector-aggregate, collector-save等でエラー分類テストが不足。

**影響**:
- エラーハンドリングの動作保証が不十分
- リグレッションリスク

**推奨対応**:
- `error-handling-patterns.md`のテストパターンを適用
- Retryable/Non-Retryable/Partial Failureのテストを追加

### 優先度: 低

#### 5. バリデーション実装の重複
**問題**: 各Lambda関数で類似のバリデーションロジックを重複実装。

**影響**:
- メンテナンス性の低下
- バリデーションルールの不整合リスク

**推奨対応**:
- 共通バリデーション関数を`src/validators/`に集約
- Zodスキーマを活用

---

## 成果物

### 不整合リスト

| 項目 | 優先度 | 詳細 | 推奨対応 |
|------|-------|------|---------|
| Zodスキーマの未使用 | 高 | 定義されているが実際には使用されていない | Zodスキーマを各Lambda関数で活用 |
| collector-aggregate/saveでのエラークラス未使用 | 高 | カスタムエラークラスが未使用 | `ValidationError`, `RetryableError`等を使用 |
| 再試行ロジックの未実装 | 中 | 一部Lambda関数で再試行未実装 | `retryWithBackoff`を適用 |
| エラー分類テストのカバレッジ不足 | 中 | テストが不足 | テストパターンを適用 |
| バリデーション実装の重複 | 低 | 各Lambda関数で重複実装 | 共通バリデーション関数に集約 |

### 申し送り事項

1. **Zodスキーマの活用**: 最優先で対応すべき不整合。型安全性とコード品質向上のため、Zodスキーマを各Lambda関数で活用することを推奨。

2. **エラーハンドリングの統一**: collector-aggregate, collector-saveでカスタムエラークラスを使用し、エラーハンドリングを統一。

3. **再試行ロジックの適用**: 外部API/AWS SDK呼び出しに`retryWithBackoff`を適用し、システムの可用性を向上。

4. **テストカバレッジの向上**: `error-handling-patterns.md`のテストパターンを適用し、エラーハンドリングの動作保証を強化。

5. **ドキュメント更新**: `error-handling-patterns.md`に検出された不整合と推奨対応を反映。

---

## 完了日時

2026-02-23 14:15:00

