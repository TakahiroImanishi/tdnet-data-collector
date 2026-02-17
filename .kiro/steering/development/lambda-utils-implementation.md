---
inclusion: fileMatch
fileMatchPattern: '**/lambda/**/utils/**/*.ts|**/lambda/**/helpers/**/*.ts|**/lambda/**/lib/**/*.ts|**/lambda/**/*.ts'
---

# Lambda内部実装ガイド

Lambda関数内部のユーティリティ・ヘルパー実装パターン。

## 実装パターン

### ユーティリティ関数

```typescript
// utils/date-formatter.ts
export function formatJSTDate(date: Date): string {
    return new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date);
}
```

### ヘルパー関数

```typescript
// helpers/validation.ts
export function validateDisclosureId(id: string): boolean {
    return /^TD\d{8}\d{3}$/.test(id);
}
```

### 共通ライブラリ

```typescript
// lib/http-client.ts
import axios from 'axios';
import { retryWithBackoff } from '../utils/retry';

export async function fetchWithRetry(url: string) {
    return retryWithBackoff(async () => {
        const response = await axios.get(url);
        return response.data;
    });
}
```

## エラーハンドリング

- `retryWithBackoff`を使用（`core/error-handling-patterns.md`参照）
- 構造化ログ（error_type, error_message, context）
- カスタムエラークラス（`src/errors/index.ts`）

## テスト

- ユニットテスト必須（`testing-strategy.md`参照）
- モック使用（外部依存を分離）

## 関連ドキュメント

- `lambda-implementation.md` - Lambda関数エントリーポイント
- `core/error-handling-patterns.md` - エラーハンドリング基本原則
- `error-handling-implementation.md` - エラーハンドリング詳細実装
- `testing-strategy.md` - テスト戦略
