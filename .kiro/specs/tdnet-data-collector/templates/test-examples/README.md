# テスト実装例

このフォルダには、各種テストの実装例が含まれています。

## ファイル一覧

### validation-tests.ts
バリデーション関数のテスト例。

**含まれるパターン:**
- 正常系テスト
- 異常系テスト
- プロパティベーステスト（fast-check）

### scraper-tests.ts
スクレイピング関数のテスト例。

**含まれるパターン:**
- モックを使用したHTTPリクエストのテスト
- HTMLパースのテスト
- エラーケースのテスト

## 使用方法

これらのファイルは、実際のテストコードを作成する際のテンプレートとして使用してください。

```typescript
// 例: バリデーションテストの作成
import { validateDisclosureId } from './validation';
import { ValidationError } from './errors';

describe('validateDisclosureId', () => {
    it('有効なIDを受け入れる', () => {
        expect(() => validateDisclosureId('20240115_7203_001')).not.toThrow();
    });
    
    it('不正な形式を拒否する', () => {
        expect(() => validateDisclosureId('invalid')).toThrow(ValidationError);
    });
});
```

## 関連ドキュメント

- **テスト戦略**: `.kiro/steering/development/testing-strategy.md`
- **データバリデーション**: `.kiro/steering/development/data-validation.md`
- **スクレイピングパターン**: `.kiro/steering/development/tdnet-scraping-patterns.md`
