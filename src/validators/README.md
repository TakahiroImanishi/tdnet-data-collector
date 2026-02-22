# Validators - データバリデーション実装ガイド

このディレクトリには、TDnet Data Collectorプロジェクトで使用するデータバリデーション機能が含まれています。

## 概要

データバリデーションは、外部APIから取得したデータの整合性を保証し、不正なデータがシステムに保存されることを防ぐための重要な機能です。このプロジェクトでは、Zodライブラリを使用した型安全なバリデーションを実装しています。

## 実装ガイドライン

### 必須参照ドキュメント

1. **データバリデーションガイドライン**  
   [`../../.kiro/steering/development/data-validation.md`](../../.kiro/steering/development/data-validation.md)
   - Zodスキーマ定義パターン
   - バリデーションエラーハンドリング
   - カスタムバリデーションルール実装
   - パフォーマンス最適化

2. **テスト戦略**  
   [`../../.kiro/steering/development/testing-strategy.md`](../../.kiro/steering/development/testing-strategy.md)
   - バリデーションロジックの単体テスト
   - エッジケーステスト
   - エラーケーステスト
   - テストカバレッジ要件

## バリデーション実装の基本原則

### 1. 型安全性
- TypeScriptの型システムとZodスキーマの連携
- `z.infer<typeof schema>`で型を自動生成
- 実行時型チェックとコンパイル時型チェックの両立

### 2. エラーハンドリング
- バリデーションエラーの構造化
- エラーメッセージの日本語化
- エラーログの記録（CloudWatch Logs）
- 部分的失敗の許容（バッチ処理）

### 3. パフォーマンス
- 不要なバリデーションの回避
- バリデーションスキーマのキャッシュ
- 大量データ処理時のメモリ効率

## 主要バリデーター

### Disclosure Validator
- 開示情報の必須フィールド検証
- 日付フォーマット検証（ISO 8601）
- disclosure_id一意性検証
- date_partition形式検証（YYYY-MM）

### API Response Validator
- TDnet APIレスポンスの構造検証
- 必須フィールドの存在確認
- データ型の検証
- 範囲チェック（日付範囲、文字列長など）

## Zodスキーマ定義例

```typescript
import { z } from 'zod';

// 基本スキーマ
export const DisclosureSchema = z.object({
  disclosure_id: z.string().min(1),
  company_code: z.string().regex(/^\d{4}$/),
  disclosed_at: z.string().datetime(),
  title: z.string().min(1),
  date_partition: z.string().regex(/^\d{4}-\d{2}$/),
});

// 型推論
export type Disclosure = z.infer<typeof DisclosureSchema>;

// バリデーション実行
export function validateDisclosure(data: unknown): Disclosure {
  return DisclosureSchema.parse(data);
}
```

## エラーハンドリングパターン

```typescript
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

try {
  const validData = validateDisclosure(rawData);
  // 処理続行
} catch (error) {
  if (error instanceof ZodError) {
    logger.error('Validation failed', {
      error_type: 'ValidationError',
      error_message: error.message,
      context: { errors: error.errors },
    });
    // エラー処理
  }
  throw error;
}
```

## テスト実装

### 単体テスト
- 正常系: 有効なデータでバリデーション成功
- 異常系: 無効なデータでバリデーション失敗
- エッジケース: 境界値、空文字列、null、undefined

### テスト実行
```bash
# バリデーターのテスト実行
npm test -- src/validators

# カバレッジ確認
npm run test:coverage -- src/validators
```

## 開発ワークフロー

1. **スキーマ設計**: データ構造の定義とバリデーションルール決定
2. **実装**: Zodスキーマ作成とバリデーション関数実装
3. **テスト**: 単体テスト作成と実行
4. **統合**: Lambda関数への組み込み
5. **検証**: E2Eテストで実データ検証

## 関連ドキュメント

- [データバリデーションガイドライン](../../.kiro/steering/development/data-validation.md)
- [テスト戦略](../../.kiro/steering/development/testing-strategy.md)
- [エラーハンドリングパターン](../../.kiro/steering/core/error-handling-patterns.md)
- [TDnet実装ルール](../../.kiro/steering/core/tdnet-implementation-rules.md)
